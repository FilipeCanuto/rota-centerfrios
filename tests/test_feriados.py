"""Authenticated holiday checks; provision public invitations with data tools."""
import datetime,json,os,secrets,unittest
from pathlib import Path
import requests
EXPECTED=[('2026-01-01','Confraternização Universal'),('2026-04-03','Paixão de Cristo'),('2026-04-21','Tiradentes'),('2026-05-01','Dia do Trabalho'),('2026-09-07','Independência do Brasil'),('2026-10-12','Nossa Senhora Aparecida'),('2026-11-02','Finados'),('2026-11-15','Proclamação da República'),('2026-11-20','Dia Nacional de Zumbi e da Consciência Negra'),('2026-12-25','Natal'),('2027-01-01','Confraternização Universal'),('2027-03-26','Paixão de Cristo'),('2027-04-21','Tiradentes'),('2027-05-01','Dia do Trabalho'),('2027-09-07','Independência do Brasil'),('2027-10-12','Nossa Senhora Aparecida'),('2027-11-02','Finados'),('2027-11-15','Proclamação da República'),('2027-11-20','Dia Nacional de Zumbi e da Consciência Negra'),('2027-12-25','Natal')]
TEST_ID='33333333-3333-4333-8333-333333333110'
class Feriados(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; cls.service={'apikey':key}
  if not key.startswith('sb_'): cls.service['Authorization']='Bearer '+key
  env=dict(l.split('=',1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
  cls.public={'apikey':env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')}; cls.accounts={}
  cls.addClassCleanup(cls.cleanup)
  for role in ['vendedor','diretoria']:
   email='feriados.'+role+'.teste@centerfrios.com'; password=secrets.token_urlsafe(32)
   r=requests.post(cls.url+'/auth/v1/admin/users',headers=cls.service,json={'email':email,'password':password,'email_confirm':True},timeout=30)
   if not r.ok: raise RuntimeError('Falha ao criar conta de teste: '+str(r.status_code))
   cls.accounts[role]={'id':r.json()['id']}
   r=requests.post(cls.url+'/auth/v1/token?grant_type=password',headers=cls.public,json={'email':email,'password':password},timeout=30)
   if not r.ok: raise RuntimeError('Falha no login de teste')
   cls.accounts[role]['headers']={**cls.public,'Authorization':'Bearer '+r.json()['access_token'],'Prefer':'return=representation'}
 @classmethod
 def cleanup(cls):
  for account in cls.accounts.values():
   r=requests.delete(cls.url+'/auth/v1/admin/users/'+account['id'],headers=cls.service,timeout=30)
   if not r.ok: raise RuntimeError('Falha ao remover conta temporária')
  print('Duas contas temporárias apagadas.')
 def api(self,role,method,table,body=None,params=None):
  return requests.request(method,self.url+'/rest/v1/'+table,headers=self.accounts[role]['headers'],json=body,params=params,timeout=30)
 def ok(self,r): self.assertTrue(r.ok,r.text[:500]); return r.json()
 def test_01_datas_exatas(self):
  rows=self.ok(self.api('vendedor','GET','feriados',params={'order':'data'}))
  self.assertEqual(len(rows),20); self.assertEqual([(r['data'],r['nome']) for r in rows],EXPECTED)
  self.assertTrue(all(r['empresa_id'] is None and r['localidade'] is None and r['abrangencia']=='nacional' and r['origem']=='manual' for r in rows))
  print('Vendedor lê os 20 feriados nacionais exatos, mesmo sem vínculo de empresa.')
 def test_02_dias_uteis(self):
  rows=self.ok(self.api('vendedor','GET','feriados')); holidays={r['data'] for r in rows}
  days=[datetime.date(2026,11,d) for d in range(1,31)]
  self.assertEqual(sum(d.weekday()<5 and d.isoformat() not in holidays for d in days),19)
  print('Novembro/2026: 19 dias úteis.')
 def test_03_vendedor_nao_insere(self):
  r=self.api('vendedor','POST','feriados',{'data':'2026-11-25','nome':'Teste recusado','abrangencia':'municipal','localidade':'Maceió'})
  self.assertEqual(r.status_code,403); self.assertEqual(r.json()['code'],'42501'); print('Vendedor: inserção recusada.')
 def test_04_diretoria_insere_audita(self):
  rows=self.ok(self.api('diretoria','POST','feriados',{'id':TEST_ID,'data':'2026-11-25','nome':'Feriado municipal de teste','abrangencia':'municipal','localidade':'Maceió'}))
  self.assertEqual(rows[0]['id'],TEST_ID)
  rows=self.ok(self.api('diretoria','GET','registro_auditoria',params={'registro_id':'eq.'+TEST_ID,'acao':'eq.alteracao_feriado'}))
  self.assertEqual(len(rows),1); row=rows[0]
  self.assertEqual(row['usuario_id'],'33333333-3333-4333-8333-333333333102')
  self.assertIsNone(row['detalhes']['antigo']); self.assertEqual(row['detalhes']['novo']['abrangencia'],'municipal')
  print('Diretoria: inserção municipal e alteracao_feriado confirmadas.')
 def test_05_diretoria_altera_apaga(self):
  rows=self.ok(self.api('diretoria','PATCH','feriados',{'nome':'Feriado municipal teste atualizado'},{'id':'eq.'+TEST_ID})); self.assertEqual(len(rows),1)
  rows=self.ok(self.api('diretoria','DELETE','feriados',params={'id':'eq.'+TEST_ID})); self.assertEqual(len(rows),1)
  rows=self.ok(self.api('diretoria','GET','registro_auditoria',params={'registro_id':'eq.'+TEST_ID}))
  self.assertEqual({r['detalhes']['operacao'] for r in rows},{'INSERT','UPDATE','DELETE'})
 def test_06_abrangencia_validada(self):
  r=self.api('diretoria','POST','feriados',{'data':'2026-11-25','nome':'Teste inválido','abrangencia':'facultativo'})
  self.assertEqual(r.status_code,400); self.assertEqual(r.json()['code'],'23514')
 def test_07_unicidade_nula(self):
  r=self.api('diretoria','POST','feriados',{'data':'2026-01-01','nome':'Duplicado','abrangencia':'nacional'})
  self.assertEqual(r.status_code,409); self.assertEqual(r.json()['code'],'23505')
if __name__=='__main__': unittest.main()
