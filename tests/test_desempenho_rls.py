"""Regression suite against current permissions; inherits the original four-profile checks."""
import json
from pathlib import Path
import requests
from test_permissoes_rls import PermissoesRLS as Original, fixture, CF
class DesempenhoRLS(Original):
 def test_11_admin_sem_comercial(self):
  for table in ['clientes','vendas','metas']:
   rows=self.ok(self.api('administrador','GET',table,params={'select':'id'})); self.assertEqual(rows,[])
   self.note('Administrador','Leitura '+table,'0 linhas')
  rows=self.ok(self.api('administrador','GET','registro_auditoria',params={'select':'tabela'}))
  self.assertTrue(all(r['tabela'] in ['usuarios','usuario_empresas','user_roles','papeis_pre_cadastro','links','equipes'] for r in rows))
  self.assertGreater(len(rows),0)
  self.note('Administrador','Auditoria','Somente ações técnicas, conforme 0005')
 def test_22_feriados(self):
  rows=self.ok(self.api('vendedor','GET','feriados',params={'select':'id'})); self.assertEqual(len(rows),20)
 def test_23_planos_autenticados(self):
  output={}
  for table,params in [('clientes',{'empresa_id':'eq.'+CF,'vendedor_id':'eq.'+fixture('101')}),('vendas',{'empresa_id':'eq.'+CF,'vendedor_id':'eq.'+fixture('101'),'data_faturamento':'gte.2026-11-01'})]:
   headers={**self.accounts['vendedor']['headers'],'Accept':'application/vnd.pgrst.plan+json; options=verbose'}
   r=requests.get(self.url+'/rest/v1/'+table,headers=headers,params=params,timeout=30)
   output[table]={'status':r.status_code,'result':r.json()}
   if r.ok:
    self.assertIn('Plan',json.dumps(r.json()))
    print(table,'plan:',json.dumps(r.json(),ensure_ascii=False))
   else: print(table,'EXPLAIN indisponível pela API:',r.status_code,r.json().get('message'))
  Path('/tmp/desempenho/plans.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
  if all(item['status']==406 for item in output.values()):
   self.skipTest('EXPLAIN autenticado indisponível na API (HTTP 406).')
# Prevent unittest from also discovering the imported original test class.
del Original
