-- ═══════════════════════════════════════════════════════════════
-- PERF-1 ≡ LM-8 : Décrément de stock ATOMIQUE
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLÈME RÉSOLU :
-- tool-orders.js décrémentait le stock en lisant stock_quantity/combinations
-- (SELECT) puis en réécrivant la valeur calculée (UPDATE) — deux commandes
-- concurrentes sur le même produit pouvaient lire la même valeur de départ
-- et écraser la décrémentation l'une de l'autre (survente).
--
-- Cette fonction fait tout en UPDATE...SET x = f(x)...WHERE id=$1, qui est
-- atomique par construction (verrouillage de ligne implicite le temps de
-- l'instruction) : deux appels concurrents se sérialisent correctement.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION decrement_product_stock(
    p_product_id UUID,
    p_quantity INTEGER,
    p_combination_attributes JSONB DEFAULT NULL
)
RETURNS TABLE(
    product_name TEXT,
    new_stock_quantity INTEGER,
    new_combination_stock INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_combo_stock INTEGER;
BEGIN
    -- Décrément atomique du stock simple. Ignoré si stock illimité (-1) ou NULL.
    UPDATE products
    SET stock_quantity = GREATEST(0, stock_quantity - p_quantity)
    WHERE id = p_product_id
      AND stock_quantity IS NOT NULL
      AND stock_quantity <> -1;

    -- Décrément atomique de la variante correspondante dans le JSONB combinations
    -- (idiome jsonb_agg + CASE : reconstruit le tableau en ne touchant que
    -- l'élément dont les attributs matchent exactement, comme combinationMatches()).
    IF p_combination_attributes IS NOT NULL THEN
        UPDATE products
        SET combinations = (
            SELECT jsonb_agg(
                CASE
                    WHEN (elem->'attributes') = p_combination_attributes
                         AND (elem->>'stock') IS NOT NULL
                         AND (elem->>'stock')::numeric >= 0
                    THEN jsonb_set(
                        jsonb_set(elem, '{stock}', to_jsonb(GREATEST(0, (elem->>'stock')::integer - p_quantity))),
                        '{available}', to_jsonb(GREATEST(0, (elem->>'stock')::integer - p_quantity) > 0)
                    )
                    ELSE elem
                END
            )
            FROM jsonb_array_elements(products.combinations) AS elem
        )
        WHERE id = p_product_id
          AND jsonb_typeof(products.combinations) = 'array';
    END IF;

    -- État final pour permettre à l'appelant d'envoyer ses notifications stock_out
    SELECT products.name, products.stock_quantity INTO product_name, new_stock_quantity
    FROM products WHERE id = p_product_id;

    IF p_combination_attributes IS NOT NULL THEN
        SELECT (elem->>'stock')::integer INTO v_combo_stock
        FROM products, jsonb_array_elements(products.combinations) AS elem
        WHERE products.id = p_product_id AND (elem->'attributes') = p_combination_attributes
        LIMIT 1;
        new_combination_stock := v_combo_stock;
    END IF;

    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_product_stock(UUID, INTEGER, JSONB) TO service_role;

COMMENT ON FUNCTION decrement_product_stock IS
'Décrémente stock_quantity et/ou la variante JSONB combinations correspondante
de manière atomique (UPDATE...SET x = f(x)). Retourne product_name +
new_stock_quantity + new_combination_stock pour piloter les notifications stock_out.';
