import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


# Os testes nao precisam de navegador, credenciais ou acesso a rede.
dotenv = types.ModuleType('dotenv')
dotenv.load_dotenv = lambda *args, **kwargs: None
playwright = types.ModuleType('playwright.sync_api')
playwright.sync_playwright = Mock()
playwright.TimeoutError = TimeoutError
playwright.Error = RuntimeError
with patch.dict(sys.modules, {
    'dotenv': dotenv, 'requests': types.ModuleType('requests'),
    'playwright': types.ModuleType('playwright'), 'playwright.sync_api': playwright,
}):
    spec = importlib.util.spec_from_file_location(
        'robot', Path(__file__).with_name('atualizar_estoques_pr_sc.py'))
    robot = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(robot)


class StockTests(unittest.TestCase):
    def test_normaliza_e_soma_codigos(self):
        rows = robot.preparar_itens_sc([
            {'codigo': ' ab ', 'descricao': 'Roda', 'quantidade': 2},
            {'codigo': 'AB', 'descricao': 'Roda', 'quantidade': 3},
        ], 'sc.xml')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['codigo'], 'AB')
        self.assertEqual(rows[0]['quantidade'], 5)

    def test_rejeita_vazio_e_negativo(self):
        with self.assertRaises(RuntimeError):
            robot.preparar_itens_sc([], 'sc.xml')
        with self.assertRaises(RuntimeError):
            robot.preparar_itens_sc([
                {'codigo': 'A', 'descricao': '', 'quantidade': -1}], 'sc.xml')
        with self.assertRaises(RuntimeError):
            robot.enviar_para_supabase(('', '', '', ''), [])

    def test_sc_nao_mexe_em_pr_e_zera_ausentes(self):
        page1 = Mock()
        page1.json.return_value = [{'codigo': 'A'}, {'codigo': 'B'}]
        page2 = Mock()
        page2.json.return_value = []
        with patch.object(robot, '_sb_headers', return_value={}), patch.object(
            robot.requests, 'get', create=True, side_effect=[page1, page2]
        ) as get, patch.object(robot, '_sb_upsert_batch') as upsert:
            result = robot.enviar_estoque_sc([
                {'codigo': 'A', 'descricao': 'Roda', 'quantidade': 4}], 'sc.xml')
            self.assertEqual(result['codigos_zerados'], 1)
            for call in get.call_args_list:
                self.assertIn('/romaneio_estoque_sc', call.args[0])
            for call in upsert.call_args_list:
                self.assertEqual(call.args[0], 'romaneio_estoque_sc')
            self.assertEqual(upsert.call_args_list[1].args[1][0]['quantidade'], 0)
            self.assertEqual(upsert.call_args_list[1].args[1][0]['codigo'], 'B')

    def test_falha_envio_nao_zera_ausentes(self):
        page1, page2 = Mock(), Mock()
        page1.json.return_value = [{'codigo': 'B'}]
        page2.json.return_value = []
        with patch.object(robot, '_sb_headers', return_value={}), patch.object(
            robot.requests, 'get', create=True, side_effect=[page1, page2]
        ), patch.object(robot, '_sb_upsert_batch', side_effect=RuntimeError('falha')) as upsert:
            with self.assertRaises(RuntimeError):
                robot.enviar_estoque_sc([
                    {'codigo': 'A', 'descricao': '', 'quantidade': 4}], 'sc.xml')
            self.assertEqual(upsert.call_count, 1)

    def test_sc_usa_empresa_e_arquivo_separados(self):
        with patch.object(robot, 'gerar_xml_e_baixar', return_value=Path('inventario_sc.xml')) as download, patch.object(
            robot, 'parse_xml_items', return_value=('MOLERI', '', '', '', [])
        ), patch.object(robot, 'enviar_estoque_sc', return_value={'itens': 1}):
            robot.pipeline_atualizar_sc()
            self.assertEqual(download.call_args.kwargs['empresa'], 'TREINAMENTO - MOLERI')
            self.assertEqual(download.call_args.kwargs['nome_arquivo'], 'inventario_sc.xml')
            self.assertEqual(download.call_args.kwargs['programa_id'], '#SGM428_000')

    def test_falha_pr_ainda_tenta_sc(self):
        with patch.object(robot, 'pipeline_atualizar', side_effect=RuntimeError('PR indisponivel')), patch.object(
            robot, 'pipeline_atualizar_sc', return_value={'itens': 2}
        ) as sc, patch('builtins.print'):
            with self.assertRaisesRegex(RuntimeError, 'Estados concluidos: SC'):
                robot.atualizar_estoques()
            sc.assert_called_once()

    def test_execucao_somente_sc(self):
        with patch.object(robot, 'pipeline_atualizar') as pr, patch.object(
            robot, 'pipeline_atualizar_sc', return_value={'itens': 2}
        ), patch('builtins.print'):
            self.assertEqual(robot.atualizar_estoques('sc')['SC']['itens'], 2)
            pr.assert_not_called()


if __name__ == '__main__':
    unittest.main()
