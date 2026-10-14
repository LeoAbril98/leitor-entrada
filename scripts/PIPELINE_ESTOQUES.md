# Estoques PR, SC e CM

O arquivo `atualizar_estoques_pr_sc.py` agora atualiza as tres filiais em
sequencia. Pode continuar usando o nome `mk_pipeline.py` no computador do robo.
O `.env` deve estar na mesma pasta do arquivo Python executado.

Mantenha as configuracoes existentes de PR, SC e Supabase. Acrescente:

```dotenv
MK_CM_EMPRESA="TREINAMENTO - CM"
MK_CM_USUARIO="LEO"
MK_CM_SENHA="SENHA_DA_CONTA_CM"
```

Nao altere `MK_SC_EMPRESA`: SC continua usando `TREINAMENTO - MOLERI`.
Nao envie senhas ou a chave administrativa ao site ou ao repositorio.

## Executar

```powershell
python mk_pipeline.py
python mk_pipeline.py --estado cm
python mk_pipeline.py --estado sc
python mk_pipeline.py --estado pr
```

Sem argumentos (ou com `--estado todos`), atualiza PR, SC e CM.
`--estado ambos` continua atualizando somente PR e SC, por compatibilidade.
Se o iniciador antigo utiliza `--estado ambos`, troque para `--estado todos`.
O argumento `--headless` continua disponivel.

## Destinos

- PR: `inventarios` e `inventario_itens`, sem alterar o fluxo existente.
- SC: `romaneio_estoque_sc`, arquivo `inventario_sc.xml`.
- CM: `romaneio_estoque_cm`, arquivo `inventario_cm.xml`.

SC e CM usam `#SGM428_000` e o mesmo formulario. Os saldos sao atualizados
por codigo, sem acumular execucoes anteriores. Depois do envio dos novos saldos,
codigos ausentes do XML ficam zerados apenas na tabela daquela filial.
XML vazio ou quantidade negativa impede o envio daquela filial.
Se uma filial falhar, as outras ainda sao tentadas. Execute novamente apenas
a filial com falha. Pendencias nao sao alteradas por este processo.

## Testes

```powershell
python scripts/test_atualizar_estoques_pr_sc.py
```

Os testes usam dados simulados, sem abrir o MK ou alterar estoques reais.
