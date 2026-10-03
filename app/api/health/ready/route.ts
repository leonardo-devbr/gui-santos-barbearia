import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await getPool().query('SELECT 1')
    return Response.json(
      { status: 'ready' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error(
      'Falha na verificação de prontidão do MySQL:',
      error instanceof Error ? error.message : 'erro desconhecido',
    )
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
