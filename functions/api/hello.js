export async function onRequest(context) {
    return new Response(JSON.stringify({ status: 'ok', path: '/api/hello' }), {
        headers: { 'Content-Type': 'application/json' }
    });
}