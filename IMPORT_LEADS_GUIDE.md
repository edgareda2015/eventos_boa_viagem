# Guia de Importação de Leads em Lote (Excel/XLSX)

Este documento descreve o processo de importação de dados de inscritos a partir de planilhas Excel (`.xlsx`) diretamente para o Supabase, além de fornecer instruções e um prompt pré-configurado para quando você desejar que o sistema implemente uma interface visual para esta finalidade.

---

## 🛠️ Detalhes do Funcionamento Atual

A importação manual mapeia os registros de uma planilha Excel (localizada na pasta `planilha_leads/PLANILHA_LEADS.xlsx`) com a seguinte estrutura de colunas:
- **DATA :** Data da inscrição (formato serial do Excel).
- **NOME:** Nome completo do inscrito.
- **CONTATO:** Telefone de contato.

### Mapeamento com a Tabela `registrations`

Para eventos com formulários simplificados (do tipo `externo` ou `mobilidade`), os dados são salvos da seguinte forma:
- **event_id:** ID do evento correspondente no banco.
- **nome:** Mapeado do campo `NOME`.
- **telefone:** Mapeado do campo `CONTATO`.
- **cpf:** Como eventos externos não exigem CPF, é gerado um identificador do tipo `EXT-{UUID}` para evitar colisões na constraint unique de CPF do banco de dados.
- **qr_token:** Um UUID gerado aleatoriamente para o check-in.
- **email, escolaridade:** Preenchidos como `'N/A'`.
- **interesse:** Preenchido como `'graduacao'`.
- **data_inscricao:** Convertida a partir do serial do Excel para formato ISO.

---

## 💻 Script de Importação Executado

O script abaixo foi executado localmente para importar os 185 participantes do evento **FLOR DA PELE VENDA DE CAMISAS LIAMA** (ID: `7c7ada3f-5a0d-47dc-8e8e-7edd6ceb27ea`):

```javascript
import XLSX from 'xlsx';
import path from 'path';
import crypto from 'crypto';

const url = 'SUA_SUPABASE_REST_URL/v1/registrations';
const key = 'SEU_SUPABASE_ANON_KEY';
const eventId = 'ID_DO_EVENTO';

const filePath = path.resolve('planilha_leads/PLANILHA_LEADS.xlsx');

function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return new Date().toISOString();
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds).toISOString();
}

async function run() {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet);

  const records = rawData.map(row => {
    const qrToken = crypto.randomUUID();
    return {
      event_id: eventId,
      nome: row['NOME'] ? row['NOME'].toString().trim() : 'N/A',
      cpf: `EXT-${qrToken}`,
      telefone: row['CONTATO'] ? row['CONTATO'].toString().trim() : 'N/A',
      email: 'N/A',
      escolaridade: 'N/A',
      interesse: 'graduacao',
      qr_token: qrToken,
      checked_in: false,
      data_inscricao: excelDateToJSDate(row['DATA '])
    };
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(records)
  });

  if (res.ok) {
    console.log(`Sucesso! ${records.length} inscritos importados.`);
  } else {
    console.error('Erro na importação:', await res.text());
  }
}

run();
```

---

## 🚀 Interface de Importação Direta no Sistema

Esta funcionalidade já foi totalmente implementada e está ativa diretamente na interface do sistema!

### Como Usar:
1. Acesse o painel administrativo (`/admin`) e selecione o evento desejado.
2. Na seção da tabela de participantes registrados, clique no botão **"Importar Excel"** (localizado logo acima da tabela, ao lado do botão de exportar).
3. Selecione o arquivo `.xlsx` ou `.xls` contendo as inscrições.
4. O sistema lerá os dados diretamente no frontend utilizando a biblioteca `xlsx`:
   - Validará se o arquivo contém a coluna de cabeçalho **"NOME"**.
   - Mapeará a coluna **"CONTATO"** ou **"TELEFONE"** se presente (caso contrário preencherá como "N/A").
   - Mapeará e converterá a coluna **"DATA"** ou **"DATA "** se presente.
   - Gerará as credenciais de check-in (`qr_token` e `cpf` com padrão externo `EXT-uuid`).
5. A importação em lote será realizada diretamente no banco e a tabela de inscritos será atualizada na tela imediatamente.

