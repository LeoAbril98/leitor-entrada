from dotenv import load_dotenv
import os
import re
import traceback
import argparse
from pathlib import Path
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
import requests

load_dotenv(Path(__file__).resolve().with_name(".env"))

from playwright.sync_api import sync_playwright

# =========================
# MK (ENV)
# =========================
MK_LOGIN = os.getenv("MK_LOGIN", "http://mkrodas.ddns.net/web/view/app/ger/GER800V.php")
MK_EMPRESA = os.getenv("MK_EMPRESA", "TREINAMENTO - MKRODAS")
MK_USUARIO = os.getenv("MK_USUARIO", "LEO")
MK_SENHA = os.getenv("MK_SENHA", "")
SC_EMPRESA = os.getenv("MK_SC_EMPRESA", "TREINAMENTO - MOLERI")
SC_USUARIO = os.getenv("MK_SC_USUARIO", "LEO")
SC_SENHA = os.getenv("MK_SC_SENHA", "")
TBL_SC = "romaneio_estoque_sc"

DOWNLOAD_DIR = Path(os.getenv("MK_DOWNLOAD_DIR", "/tmp" if os.name != 'nt' else str(Path.home() / "Downloads")))

# =========================
# Supabase (ENV)
# =========================
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
TBL_INV = os.getenv("SB_TBL_INV", "inventarios")
TBL_ITENS = os.getenv("SB_TBL_ITENS", "inventario_itens")
BATCH_SIZE = int(os.getenv("SB_BATCH_SIZE", "500"))

def _sb_headers():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Faltou SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY (env).")
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

def _chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

# =========================
# 1) GERAR e BAIXAR XML
# =========================
def abrir_relatorio_estoque(page, programa_id="#SGM428_008", timeout=60000):
    cartao = page.locator(programa_id)
    cartao.wait_for(state="visible", timeout=timeout)
    cartao.click()
    iframe = page.frame_locator('iframe[name="iframe_tab2"]')
    iframe.get_by_role("textbox", name="Grupo", exact=True).wait_for(
        state="visible", timeout=timeout
    )
    return iframe


def gerar_xml_e_baixar(grupo_ini="050", grupo_fin="051", situacao="A", headless=False,
                      empresa=MK_EMPRESA, usuario=MK_USUARIO, senha=MK_SENHA,
                      nome_arquivo="inventario_pr.xml", programa_id="#SGM428_008"):
    if not senha:
        raise RuntimeError(f"Configure a senha no .env para {empresa}.")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless, slow_mo=80)
        context = browser.new_context(ignore_https_errors=True, accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(60000)

        try:
            print("1) Fazendo login no MK...", flush=True)
            page.goto(MK_LOGIN, wait_until="domcontentloaded")
            
            page.get_by_text(empresa, exact=True).click()
            page.get_by_role("textbox", name="Usuário", exact=True).fill(usuario)
            page.get_by_role("textbox", name="Senha do Usuário").fill(senha)
            page.get_by_role("button", name="Acessar").click()

            print("2) Abrindo relatorio SGM428...", flush=True)
            iframe = abrir_relatorio_estoque(page, programa_id=programa_id)

            print(f"3) Preenchendo filtros (Grupo: {grupo_ini} a {grupo_fin}, Situação: {situacao})...", flush=True)
            iframe.get_by_role("textbox", name="Grupo", exact=True).click()
            iframe.get_by_role("textbox", name="Grupo", exact=True).fill(grupo_ini)
            
            iframe.get_by_title("Grupo Fin", exact=True).click()
            iframe.get_by_title("Grupo Fin", exact=True).fill(grupo_fin)
            
            iframe.get_by_label("Situação Item - Ambos A -").select_option(situacao)

            print("4) Clicando em Gerar e aguardando processamento...", flush=True)
            iframe.get_by_role("button", name="Gerar").click()

            print("5) Aguardando o relatório carregar e o link XML aparecer...", flush=True)
            link_xml = iframe.get_by_role("link", name="Download no formato XML")
            link_xml.wait_for(state="visible", timeout=120000)
            
            page.wait_for_timeout(2000)

            print("5.1) Acionando o link de Download XML...", flush=True)
            with page.expect_download(timeout=120000) as download_info:
                link_xml.click()
            
            download = download_info.value
            
            print(f"Nome original do arquivo gerado pelo MK: {download.suggested_filename}", flush=True)
            
            xml_path = DOWNLOAD_DIR / nome_arquivo
            xml_path.parent.mkdir(parents=True, exist_ok=True)
            download.save_as(str(xml_path))
            
            print(f"✅ Arquivo baixado com sucesso em: {xml_path}", flush=True)
            return xml_path

        finally:
            browser.close()

# =========================
# 2) PARSE XML
# =========================
def _get_text(el) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()

def parse_qty_br(qty_str: str) -> int:
    s = (qty_str or "").strip()
    if not s:
        return 0
    s = s.replace(".", "")
    if "," in s:
        s = s.split(",")[0]
    s = re.sub(r"[^\d-]", "", s)
    try:
        return int(s) if s else 0
    except:
        return 0

def parse_xml_items(xml_path: Path):
    try:
        tree = ET.parse(str(xml_path))
        root = tree.getroot()
    except Exception as e:
        print(f"❌ ERRO CRÍTICO AO LER O XML: {e}", flush=True)
        with open(xml_path, 'r', encoding='utf-8', errors='ignore') as f:
            conteudo = f.read(500)
        print(f"⚠️ CONTEÚDO DO ARQUIVO BAIXADO:\n{conteudo}", flush=True)
        raise RuntimeError(f"Falha ao ler XML. Arquivo inválido ou corrompido.")

    header = root.find("header")
    empresa = _get_text(header.find("cab-empresa")) if header is not None else ""
    filial = _get_text(header.find("cab-filial")) if header is not None else ""
    equipe = "" 
    depositos_xml = "" 

    items = []
    detail = root.find("detail")
    if detail is None:
        return (empresa, filial, equipe, depositos_xml, items)

    for rec in detail.findall("record"):
        codigo_el = rec.find("det-produto")
        if codigo_el is None or not _get_text(codigo_el):
            continue 

        codigo = _get_text(codigo_el)
        descricao = _get_text(rec.find("det-desc-produto"))
        qty_raw = _get_text(rec.find("det-qtde"))
        local = _get_text(rec.find("det-localizacao-1"))

        quantidade = parse_qty_br(qty_raw)

        items.append(
            {"codigo": codigo, "descricao": descricao, "quantidade": quantidade, "local": local}
        )

    return (empresa, filial, equipe, depositos_xml, items)

# =========================
# 3) ENVIAR SUPABASE
# =========================
def _sb_insert_one(table: str, payload: dict) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    h = _sb_headers()
    h["Prefer"] = "return=representation"
    r = requests.post(url, headers=h, json=[payload], timeout=60)
    r.raise_for_status()
    data = r.json()
    if not data:
        raise RuntimeError("Supabase não retornou registro inserido.")
    return data[0]

def _sb_upsert_batch(table: str, rows: list[dict], on_conflict: str):
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}"
    h = _sb_headers()
    h["Prefer"] = "resolution=merge-duplicates,return=minimal"
    r = requests.post(url, headers=h, json=rows, timeout=120)
    r.raise_for_status()

def _sb_delete_all_itens():
    # Apaga APENAS os itens da tabela inventario_itens usando um filtro válido no Supabase
    url = f"{SUPABASE_URL}/rest/v1/{TBL_ITENS}?inventario_id=not.is.null"
    h = _sb_headers()
    h["Prefer"] = "return=minimal"
    r = requests.delete(url, headers=h, timeout=60)
    if r.status_code >= 400 and r.status_code != 404:
        raise RuntimeError(f"Falha ao limpar itens antigos: {r.text}")

def enviar_para_supabase(meta, items):
    if not items:
        raise RuntimeError("XML PR sem itens. Estoque anterior preservado.")
    empresa, filial, equipe, depositos = meta
    criado_em = datetime.now(timezone.utc).isoformat()

    url_inv = f"{SUPABASE_URL}/rest/v1/{TBL_INV}"
    h = _sb_headers()
    h["Prefer"] = "return=representation"

    # Pega o inventário existente ou cria um se não houver nenhum
    r_busca = requests.get(f"{url_inv}?select=id&limit=1", headers=h, timeout=30)
    r_busca.raise_for_status()
    
    if r_busca.status_code < 400 and r_busca.json():
        inv_id = r_busca.json()[0]["id"]
        print(f"🔄 Reaproveitando inventário ID: {inv_id}", flush=True)
        # Atualiza a data do cabeçalho
        r_update = requests.patch(
            f"{url_inv}?id=eq.{inv_id}",
            headers=h,
            json={"criado_em": criado_em, "empresa": empresa, "filial": filial},
            timeout=30
        )
        r_update.raise_for_status()
    else:
        print("✨ Criando registro de inventário...", flush=True)
        inv_row = _sb_insert_one(
            TBL_INV,
            {
                "empresa": empresa,
                "filial": filial,
                "equipe": equipe,
                "depositos": depositos,
                "criado_em": criado_em,
            },
        )
        inv_id = inv_row["id"]

    # Limpa APENAS os itens antigos para evitar duplicação, mantendo o ID e as pendências intactas
    print("🧹 Limpando itens antigos de inventario_itens...", flush=True)
    _sb_delete_all_itens()

    # Prepara os novos itens vinculados ao mesmo ID
    rows = [
        {
            "inventario_id": inv_id,
            "codigo": it["codigo"],
            "descricao": it["descricao"],
            "quantidade": it["quantidade"],
            "local": it["local"],
        }
        for it in items
    ]

    # Insere os itens novos em lotes
    sent = 0
    for batch in _chunks(rows, BATCH_SIZE):
        _sb_upsert_batch(TBL_ITENS, batch, on_conflict="inventario_id,codigo")
        sent += len(batch)

    return inv_id, sent
# =========================
# PIPELINE COMPLETO
# =========================
def pipeline_atualizar(grupo_ini="050", grupo_fin="051", situacao="A", deposito="ALMOX", headless=False):
    try:
        xml_path = gerar_xml_e_baixar(grupo_ini=grupo_ini, grupo_fin=grupo_fin, situacao=situacao, headless=headless)
        
        print("6) Fazendo o parse do XML...", flush=True)
        empresa, filial, equipe, depositos_xml, items = parse_xml_items(xml_path)
        
        print("7) Enviando dados para o Supabase...", flush=True)
        inv_id, sent = enviar_para_supabase((empresa, filial, equipe, deposito), items)
        
        return {
            "inventario_id": inv_id,
            "itens": sent,
            "empresa": empresa,
            "filial": filial,
            "equipe": equipe,
            "depositos": deposito,
            "xml_path": str(xml_path),
        }
    except Exception as e:
        err_msg = traceback.format_exc()
        print(f"\n❌ ERRO DETALHADO NO PIPELINE:\n{err_msg}", flush=True)
        raise

def preparar_itens_sc(items, arquivo_origem):
    if not items:
        raise RuntimeError("XML SC sem itens. Estoque anterior preservado.")
    por_codigo = {}
    for item in items:
        codigo = item["codigo"].strip().upper()
        if not codigo:
            raise RuntimeError("Codigo SC vazio. Estoque anterior preservado.")
        quantidade = item["quantidade"]
        if quantidade < 0:
            raise RuntimeError(f"Quantidade SC negativa para {codigo}. Revise o XML.")
        if codigo not in por_codigo:
            por_codigo[codigo] = {
                "codigo": codigo, "descricao": item["descricao"],
                "quantidade": 0, "arquivo_origem": arquivo_origem,
            }
        por_codigo[codigo]["quantidade"] += quantidade
    return list(por_codigo.values())


def enviar_estoque_sc(items, xml_path):
    rows = preparar_itens_sc(items, Path(xml_path).name)
    h = _sb_headers()
    # Leia todos os codigos anteriores antes de alterar qualquer saldo.
    anteriores = set()
    offset = 0
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{TBL_SC}", headers=h,
            params={"select": "codigo", "order": "codigo", "offset": offset, "limit": 1000},
            timeout=60,
        )
        r.raise_for_status()
        page = r.json()
        anteriores.update(item["codigo"] for item in page)
        if not page:
            break
        offset += len(page)
    for batch in _chunks(rows, BATCH_SIZE):
        _sb_upsert_batch(TBL_SC, batch, on_conflict="codigo")

    # Somente depois do envio, zere itens ausentes do novo relatorio.
    ausentes = sorted(anteriores - {row["codigo"] for row in rows})
    zeros = [
        {"codigo": codigo, "quantidade": 0, "arquivo_origem": Path(xml_path).name}
        for codigo in ausentes
    ]
    for batch in _chunks(zeros, BATCH_SIZE):
        _sb_upsert_batch(TBL_SC, batch, on_conflict="codigo")
    return {"itens": len(rows), "codigos_zerados": len(zeros), "xml_path": str(xml_path)}


def pipeline_atualizar_sc(headless=False):
    xml_path = gerar_xml_e_baixar(
        headless=headless, empresa=SC_EMPRESA, usuario=SC_USUARIO,
        senha=SC_SENHA, nome_arquivo="inventario_sc.xml", programa_id="#SGM428_000",
    )
    empresa, filial, equipe, depositos, items = parse_xml_items(xml_path)
    resultado = enviar_estoque_sc(items, xml_path)
    resultado.update({"empresa": empresa, "filial": filial})
    return resultado


def atualizar_estoques(estado="ambos", headless=False):
    if estado not in ("ambos", "pr", "sc"):
        raise ValueError("Estado deve ser ambos, pr ou sc.")
    if BATCH_SIZE <= 0:
        raise ValueError("SB_BATCH_SIZE deve ser maior que zero.")
    resultados = {}
    falhas = {}
    tarefas = {
        "PR": lambda: pipeline_atualizar(headless=headless),
        "SC": lambda: pipeline_atualizar_sc(headless=headless),
    }
    for uf, tarefa in tarefas.items():
        if estado != "ambos" and estado.upper() != uf:
            continue
        print(f"Atualizando estoque {uf}...", flush=True)
        try:
            resultados[uf] = tarefa()
            print(f"Estoque {uf} atualizado: {resultados[uf]['itens']} itens.", flush=True)
        except Exception:
            falhas[uf] = traceback.format_exc()
            print(f"Falha no estoque {uf}:\n{falhas[uf]}", flush=True)
    if falhas:
        raise RuntimeError(
            "Atualizacao incompleta. Estados com falha: " + ", ".join(falhas)
            + ". Estados concluidos: " + (", ".join(resultados) or "nenhum")
            + ". Execute novamente apenas o estado com falha."
        )
    return resultados


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Atualiza PR e SC separadamente no Supabase.")
    parser.add_argument("--estado", choices=["ambos", "pr", "sc"], default="ambos")
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()
    atualizar_estoques(estado=args.estado, headless=args.headless)
