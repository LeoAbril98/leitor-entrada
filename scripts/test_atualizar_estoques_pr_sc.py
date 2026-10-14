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

    def test_filiais_isoladas_e_zeram_ausentes(self):
        for origem in ('SC', 'CM'):
            with self.subTest(origem=origem):
                self.verificar_filial(origem)

    def verificar_filial(self, origem):
        page1 = Mock()
        page1.json.return_value = [{'codigo': 'A'}, {'codigo': 'B'}]
        page2 = Mock()
        page2.json.return_value = []
        with patch.object(robot, '_sb_headers', return_value={}), patch.object(
            robot.requests, 'get', create=True, side_effect=[page1, page2]
        ) as get, patch.object(robot, '_sb_upsert_batch') as upsert:
            result = robot.enviar_estoque_filial([
                {'codigo': 'A', 'descricao': 'Roda', 'quantidade': 4}], 'estoque.xml', origem)
            self.assertEqual(result['codigos_zerados'], 1)
            for call in get.call_args_list:
                self.assertTrue(call.args[0].endswith(f'/romaneio_estoque_{origem.lower()}'))
            for call in upsert.call_args_list:
                self.assertEqual(call.args[0], f'romaneio_estoque_{origem.lower()}')
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

    def test_cm_usa_empresa_e_arquivo_separados(self):
        with patch.object(robot, 'gerar_xml_e_baixar', return_value=Path('inventario_cm.xml')) as download, patch.object(
            robot, 'parse_xml_items', return_value=('CM', '', '', '', [])
        ), patch.object(robot, 'enviar_estoque_cm', return_value={'itens': 1}) as send:
            robot.pipeline_atualizar_cm(headless=True)
            self.assertEqual(download.call_args.kwargs['empresa'], 'TREINAMENTO - CM')
            self.assertEqual(download.call_args.kwargs['usuario'], robot.CM_USUARIO)
            self.assertEqual(download.call_args.kwargs['senha'], robot.CM_SENHA)
            self.assertEqual(download.call_args.kwargs['nome_arquivo'], 'inventario_cm.xml')
            self.assertEqual(download.call_args.kwargs['programa_id'], '#SGM428_000')
            self.assertTrue(download.call_args.kwargs['headless'])
            send.assert_called_once_with([], Path('inventario_cm.xml'))

    def test_cm_rejeita_vazio_e_negativo_antes_de_enviar(self):
        for items in ([], [{'codigo': 'A', 'descricao': '', 'quantidade': -1}]):
            with patch.object(robot, '_sb_headers') as headers, self.assertRaises(RuntimeError):
                robot.enviar_estoque_cm(items, 'cm.xml')
            headers.assert_not_called()

    def test_falha_pr_ainda_tenta_sc_e_cm(self):
        with patch.object(robot, 'pipeline_atualizar', side_effect=RuntimeError('PR indisponivel')), patch.object(
            robot, 'pipeline_atualizar_sc', return_value={'itens': 2}
        ) as sc, patch.object(robot, 'pipeline_atualizar_cm', return_value={'itens': 3}) as cm, patch('builtins.print'):
            with self.assertRaisesRegex(RuntimeError, 'Estados concluidos: SC, CM'):
                robot.atualizar_estoques()
            sc.assert_called_once()
            cm.assert_called_once()

    def test_execucao_somente_cm(self):
        with patch.object(robot, 'pipeline_atualizar') as pr, patch.object(robot, 'pipeline_atualizar_sc') as sc, patch.object(
            robot, 'pipeline_atualizar_cm', return_value={'itens': 3}
        ), patch('builtins.print'):
            self.assertEqual(robot.atualizar_estoques('cm')['CM']['itens'], 3)
            pr.assert_not_called()
            sc.assert_not_called()

    def test_ambos_preserva_pr_e_sc_sem_cm(self):
        with patch.object(robot, 'pipeline_atualizar', return_value={'itens': 1}), patch.object(
            robot, 'pipeline_atualizar_sc', return_value={'itens': 2}
        ), patch.object(robot, 'pipeline_atualizar_cm') as cm, patch('builtins.print'):
            self.assertEqual(set(robot.atualizar_estoques('ambos')), {'PR', 'SC'})
            cm.assert_not_called()

    def test_execucao_somente_sc(self):
        with patch.object(robot, 'pipeline_atualizar') as pr, patch.object(
            robot, 'pipeline_atualizar_sc', return_value={'itens': 2}
        ), patch('builtins.print'):
            self.assertEqual(robot.atualizar_estoques('sc')['SC']['itens'], 2)
            pr.assert_not_called()


if __name__ == '__main__':
    unittest.main()
