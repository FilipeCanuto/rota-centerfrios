INSERT INTO public.user_roles(user_id, role, empresa_id, origem)
SELECT u.auth_user_id, 'diretoria', NULL, 'manual'
FROM public.usuarios u
WHERE lower(u.email) = 'adm@centerfrios.com' AND u.auth_user_id IS NOT NULL
ON CONFLICT (user_id, role, empresa_id) DO NOTHING;