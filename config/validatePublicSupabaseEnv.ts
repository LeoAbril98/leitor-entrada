export function validatePublicSupabaseEnv(env: Record<string, string>) {
    for (const [name, value] of Object.entries(env)) {
        if (!name.startsWith('VITE_') || !name.includes('SUPABASE')) continue;
        let role = '';
        try { role = JSON.parse(Buffer.from(value.split('.')[1] || '', 'base64url').toString()).role || ''; }
        catch { /* Chaves publishable nao usam JWT. */ }
        if (value.startsWith('sb_secret_') || role === 'service_role') {
            throw new Error(`${name}: use a chave publica anon/publishable. Chaves administrativas nao podem entrar no site.`);
        }
    }
}
