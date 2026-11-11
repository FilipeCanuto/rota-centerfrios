"""Authenticated aggregate regression tests; public fixtures use data tools."""
import datetime,json,os,secrets,unittest
from pathlib import Path
from zoneinfo import ZoneInfo
import requests
CF='49ddeee5-cbe2-4bf0-a53b-f5f7ef3e31b1'; SELLER='44444444-4444-4444-8444-444444444101'; DEMO='830d3560-06b0-4506-b40c-6ba424e34ce0'
class Painel(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; k=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.service={'apikey':k}
  if not k.startswith('sb_'): cls.service['Authorization']='Bearer '+k
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.public={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.auth_id=None; cls.addClassCleanup(cls.cleanup)
  password=secrets.token_urlsafe(32); email='painel.vendedor.teste@centerfrios.com'
  r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.service,json={'email':email,'password':password,'email_confirm':True},timeout=30)
  if not r.ok: raise RuntimeError('Falha ao criar conta temporária')
  cls.auth_id=r.json()['id']
  r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.public,json={'email':email,'password':password},timeout=30)
  if not r.ok: raise RuntimeError('Falha ao entrar')
  cls.headers={**cls.public,'Authorization':'Bearer '+r.json()['access_token']}
 @classmethod
 def cleanup(cls):
  if cls.auth_id:
   r=requests.delete(cls.url+'/auth/v1/admin/users/'+cls.auth_id,headers=cls.service,timeout=30)
   if not r.ok: raise RuntimeError('Falha ao apagar conta temporária')
 def rpc(self,fn,seller=SELLER,day='2026-11-10',headers=None):
  r=requests.post(self.url+'/rest/v1/rpc/'+fn,headers=headers or self.headers,json={'_empresa_id':CF,'_vendedor_id':seller,'_hoje':day},timeout=60)
  self.assertTrue(r.ok,r.text[:500]); return r.json()
 def test_01_demo_soma(self):
  panel=self.rpc('painel_vendedor',DEMO,headers=self.service)
  self.assertEqual(panel['faturado_mes'],33428.42)
  print('Demo: painel = soma SQL direta = 33428.42')
 def test_02_1500_vendas(self):
  panel=self.rpc('painel_vendedor'); self.assertEqual(panel['faturado_mes'],15000); self.assertEqual(panel['faturado_hoje'],15000)
  print('1500 vendas de 10: faturado_mes = 15000')
 def test_03_fuso(self):
  panel=self.rpc('painel_vendedor'); row=next(c for c in panel['clientes'] if c['id'].endswith('121'))
  self.assertEqual(row['ultima_interacao'],'2026-11-10'); self.assertEqual(row['ultima_interacao_qualificada'],'2026-11-10'); self.assertIs(row['qualificada_hoje'],True)
  nextday=self.rpc('painel_vendedor',day='2026-11-11'); row=next(c for c in nextday['clientes'] if c['id'].endswith('121')); self.assertIs(row['qualificada_hoje'],False)
  print('23:30-03 conta em 10/11, não em 11/11')
 def test_04_outro_vendedor(self):
  panel=self.rpc('painel_vendedor',DEMO); self.assertEqual(panel['clientes'],[]); self.assertIsNone(panel['meta'])
  for field in ['faturado_mes','faturado_hoje','orcamentos_mes','orcamentos_hoje','pontos_hoje']: self.assertEqual(panel[field],0)
  self.assertEqual(self.rpc('cobertura_vendedor',DEMO),{'total':0,'cobertos':0})
  print('Outro vendedor: carteira vazia; somas e cobertura zero')
 def test_05_cobertura(self):
  panel=self.rpc('painel_vendedor'); coverage=self.rpc('cobertura_vendedor')
  count=sum(c['comprou_no_mes'] or c['qualificada_no_mes'] for c in panel['clientes'])
  self.assertEqual(coverage,{'total':3,'cobertos':2}); self.assertEqual(count,coverage['cobertos'])
  print('Cobertura leve e painel: 2 cobertos de 3')
 def test_06_historico_separado(self):
  panel=self.rpc('painel_vendedor'); row=next(c for c in panel['clientes'] if c['id'].endswith('120'))
  self.assertEqual(len(row['compras']),12); self.assertEqual(len(set(row['compras'])),12); self.assertEqual(row['compras'],sorted(row['compras'],reverse=True))
  self.assertEqual(row['compras'][0],'2026-11-10'); self.assertIsNone(row['ultima_interacao_qualificada']); self.assertIs(row['qualificada_no_mes'],False)
 def test_07_agregados_restantes(self):
  panel=self.rpc('painel_vendedor'); self.assertEqual(panel['orcamentos_mes'],1); self.assertEqual(panel['orcamentos_hoje'],1); self.assertEqual(panel['pontos_hoje'],7)
  self.assertEqual(panel['meta'],{'meta_vendas':20000,'meta_orcamentos':12,'meta_cobertura':70,'meta_reativacao':3})
  row=next(c for c in panel['clientes'] if c['id'].endswith('120')); self.assertEqual(len(row['orcamentos_abertos']),1); self.assertEqual(row['orcamentos_abertos'][0]['valor'],50)
 def test_08_resultado_vazio(self):
  row=next(c for c in self.rpc('painel_vendedor')['clientes'] if c['id'].endswith('122')); self.assertIsNone(row['ultima_interacao_qualificada']); self.assertIs(row['qualificada_hoje'],False)
 def test_09_hoje_nulo(self):
  today=datetime.datetime.now(ZoneInfo('America/Maceio')).date().isoformat()
  for fn in ['painel_vendedor','cobertura_vendedor']: self.assertEqual(self.rpc(fn,day=None),self.rpc(fn,day=today))
if __name__=='__main__': unittest.main()
