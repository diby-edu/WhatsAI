import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    let locale = await requestLocale;

    // Ensure that a valid locale is used
    if (!locale || !['fr', 'en'].includes(locale)) {
        locale = 'fr';
    }

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default
    };
});
