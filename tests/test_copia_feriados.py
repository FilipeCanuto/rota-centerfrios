"""Authenticated director regression; removes all holiday fixtures in finally."""
import json
import unittest
from pathlib import Path
import requests


class CopiaFeriados(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        env = dict(l.split('=', 1) for l in Path('.env').read_text().splitlines() if '=' in l and not l.startswith('#'))
        cls.url = env['VITE_SUPABASE_URL'].strip('"')
        session = json.loads(Path.home().joinpath('.cache/lovable-auth/session.json').read_text())['session']
        cls.headers = {'apikey': env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"'), 'Authorization': 'Bearer ' + session['access_token'], 'Prefer': 'return=representation'}
        cls.ids = []
        cls.addClassCleanup(cls.cleanup)

    @classmethod
    def request(cls, method, path, body=None, params=None):
        return requests.request(method, cls.url + '/rest/v1/' + path, headers=cls.headers, json=body, params=params, timeout=30)

    @classmethod
    def cleanup(cls):
        if cls.ids:
            r = cls.request('DELETE', 'feriados', params={'id': 'in.(' + ','.join(cls.ids) + ')'})
            if not r.ok:
                raise RuntimeError('Holiday fixture cleanup failed')
        Path('/tmp/browser/feriados-editaveis/fixture_ids.json').write_text(json.dumps(cls.ids))

    def ok(self, r):
        self.assertTrue(r.ok, 'Request failed: ' + str(r.status_code))
        return r.json()

    def insert(self, body):
        rows = self.ok(self.request('POST', 'feriados', body))
        self.ids.append(rows[0]['id'])
        return rows[0]

    def test_01_mobile_flags_and_loader(self):
        rows = self.ok(self.request('GET', 'feriados', params={'nome': 'eq.Paixão de Cristo'}))
        self.assertEqual({r['data'] for r in rows}, {'2026-04-03', '2027-03-26'})
        self.assertTrue(all(r['data_movel'] for r in rows))
        self.assertEqual(self.ok(self.request('POST', 'rpc/carregar_feriados_nacionais', {})), 0)

    def test_02_company_holiday_audit_and_copy(self):
        self.assertEqual(self.ok(self.request('GET', 'feriados', params={'data': 'gte.2028-01-01', 'and': '(data.lte.2028-12-31)'})), [])
        carnival = self.insert({'data': '2027-02-09', 'nome': 'Carnaval', 'abrangencia': 'empresa', 'data_movel': True, 'empresa_id': None})
        audit = self.ok(self.request('GET', 'registro_auditoria', params={'registro_id': 'eq.' + carnival['id'], 'acao': 'eq.alteracao_feriado'}))
        self.assertEqual(len(audit), 1)
        self.assertEqual(audit[0]['detalhes']['novo']['abrangencia'], 'empresa')
        first = self.ok(self.request('POST', 'rpc/copiar_feriados_para_ano', {'_ano_origem': 2027, '_ano_destino': 2028}))
        created = self.ok(self.request('GET', 'feriados', params={'data': 'gte.2028-01-01', 'and': '(data.lte.2028-12-31)'}))
        self.ids.extend(r['id'] for r in created)
        self.assertEqual(first, {'copiados': 9, 'ja_existiam': 0, 'ignorados_moveis': 2})
        self.assertEqual(len(created), 9)
        self.assertTrue(all(r['nome'] not in ['Paixão de Cristo', 'Carnaval'] and not r['data_movel'] for r in created))
        self.assertEqual(self.ok(self.request('POST', 'rpc/copiar_feriados_para_ano', {'_ano_origem': 2027, '_ano_destino': 2028})), {'copiados': 0, 'ja_existiam': 9, 'ignorados_moveis': 2})

    def test_03_leap_day_and_company_scope_preserved(self):
        company = '49ddeee5-cbe2-4bf0-a53b-f5f7ef3e31b1'
        self.insert({'data': '2096-02-29', 'nome': 'Teste bissexto', 'abrangencia': 'empresa', 'empresa_id': company})
        self.insert({'data': '2096-06-08', 'nome': 'Teste fixo empresa', 'abrangencia': 'municipal', 'empresa_id': company, 'localidade': 'Maceió'})
        result = self.ok(self.request('POST', 'rpc/copiar_feriados_para_ano', {'_ano_origem': 2096, '_ano_destino': 2097}))
        rows = self.ok(self.request('GET', 'feriados', params={'data': 'gte.2097-01-01', 'and': '(data.lte.2097-12-31)'}))
        self.ids.extend(r['id'] for r in rows)
        self.assertEqual(result, {'copiados': 1, 'ja_existiam': 0, 'ignorados_moveis': 0})
        self.assertEqual([(r['data'], r['empresa_id'], r['localidade'], r['abrangencia']) for r in rows], [('2097-06-08', company, 'Maceió', 'municipal')])


if __name__ == '__main__':
    unittest.main()