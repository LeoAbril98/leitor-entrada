import assert from 'node:assert/strict';
import { validatePublicSupabaseEnv } from '../config/validatePublicSupabaseEnv';

const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
assert.doesNotThrow(() => validatePublicSupabaseEnv({ VITE_SUPABASE_ANON_KEY: jwt('anon') }));
assert.doesNotThrow(() => validatePublicSupabaseEnv({ VITE_SUPABASE_ANON_KEY: 'sb_publishable_public' }));
assert.throws(() => validatePublicSupabaseEnv({ VITE_SUPABASE_ANON_KEY: jwt('service_role') }), /administrativas/);
assert.throws(() => validatePublicSupabaseEnv({ VITE_SUPABASE_ANON_KEY: 'sb_secret_private' }), /administrativas/);
assert.throws(() => validatePublicSupabaseEnv({ VITE_SUPABASE_SERVICE_ROLE_KEY: jwt('service_role') }), /administrativas/);
assert.doesNotThrow(() => validatePublicSupabaseEnv({ SUPABASE_SERVICE_ROLE_KEY: jwt('service_role') }));
console.log('PASS: chaves publicas aceitas; chaves administrativas bloqueadas no frontend.');
