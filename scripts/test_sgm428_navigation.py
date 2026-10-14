import importlib.util
from pathlib import Path
from playwright.sync_api import sync_playwright


spec = importlib.util.spec_from_file_location(
    'robot', Path(__file__).with_name('atualizar_estoques_pr_sc.py'))
robot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(robot)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page()
    for uf, cartao_id, frame_name, cards in [
        ('PR', 'SGM428_008', 'iframe_tab2', 8),
        ('SC', 'SGM428_000', 'iframe_tab2', 0),
        ('CM', 'SGM428_000', 'iframe_tab2', 0),
    ]:
        other_cards = '<button>Outro programa</button>' * cards
        page.set_content(f'''
            <span hidden>SGM428</span>
            {other_cards}
            <button id="{cartao_id}" onclick="document.querySelector('iframe').hidden=false">
                <strong>SGM428</strong><span>Relat. Estoque fisico</span>
            </button>
            <iframe hidden name="{frame_name}" srcdoc='
                <label>Grupo <input type="text"></label>
                <input type="text" title="Grupo Fin">
                <button>Gerar</button>'></iframe>
        ''')
        frame = robot.abrir_relatorio_estoque(page, programa_id=f'#{cartao_id}', timeout=5000)
        frame.get_by_role('textbox', name='Grupo', exact=True).fill('050')
        assert frame.get_by_role('textbox', name='Grupo', exact=True).input_value() == '050'
        print(f'{uf}: identificador {cartao_id} e filtros no iframe_tab2 OK')
    browser.close()
