REVOKE EXECUTE ON FUNCTION public.apagar_dados_demo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apagar_dados_demo() TO service_role;