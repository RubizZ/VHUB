import { NextResponse } from 'next/server';
import { getHydratedAgents } from '@/lib/services/agents';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lang = url.searchParams.get('lang') || request.headers.get('accept-language')?.split(',')[0] || 'es-ES';
    
    // Convert to supported format (es-ES, en-US, etc.)
    let parsedLang = 'es-ES';
    if (lang.toLowerCase().startsWith('en')) parsedLang = 'en-US';
    else if (lang.toLowerCase().startsWith('es')) parsedLang = 'es-ES';
    else if (lang.toLowerCase().startsWith('pt')) parsedLang = 'pt-BR';
    else if (lang.toLowerCase().startsWith('fr')) parsedLang = 'fr-FR';

    const agents = await getHydratedAgents(parsedLang);
    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}
