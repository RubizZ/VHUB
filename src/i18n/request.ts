import {getRequestConfig} from 'next-intl/server';
import {cookies} from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'es-ES';

  let messages = {};
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    try {
      messages = (await import(`../../messages/es-ES.json`)).default;
    } catch(e) {}
  }

  return {
    locale,
    messages
  };
});
