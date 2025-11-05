# Checkout Backend - ConnectPay API

Backend seguro para geração de Pix via ConnectPay.

## 📦 Arquivos Necessários para Deploy

Para fazer upload no Render.com, você precisa APENAS destes 3 arquivos:

```
✓ server.js
✓ package.json
✓ package-lock.json
```

**NÃO faça upload de:**
- ❌ `node_modules/` (será instalado automaticamente)
- ❌ `.env` (configure no painel do Render)

## 🚀 Variáveis de Ambiente

Configure estas variáveis no painel do Render.com:

```
CONNECTPAY_API_SECRET=sk_7029eea634b02df91d011a60ba0e4488ef93fa7f033077573db2d7514e697eaa0fe0777cf4ee7589cdadae79de0ac998a0ec1662accfb9161f3d7aa4d99c9096
CONNECTPAY_RECIPIENT_ID=  # ⚠️ DESABILITADO - Não use sem verificar se é da sua conta!
PORT=3000
GOOGLE_SHEETS_WEBHOOK=https://script.google.com/macros/s/AKfycby4RoLNnz-KHuN-rPbpkTCVqqHYzk6Yf_tr-BQDUQw-AF0HPidXEI8aFum2SCpjCIr-/exec
TIKTOK_API_TOKEN=14feb461b0d55d3efdc33678bcc36de35bfcafcd
```

**Nota:** 
- `CONNECTPAY_API_SECRET`: **Obrigatório**. Esta é sua Chave API da ConnectPay.
- `CONNECTPAY_RECIPIENT_ID`: **⚠️ DESABILITADO POR SEGURANÇA**. O split de pagamento foi desabilitado no código. Se você precisar usar, primeiro VERIFIQUE na ConnectPay que o recipient_id pertence à SUA conta. Caso contrário, 100% do dinheiro será redirecionado para outra pessoa.
- `TIKTOK_API_TOKEN`: Opcional e usado para TikTok Events API (Server-side) se necessário.

## 🔧 Comandos de Build

**Build Command:**
```
npm install
```

**Start Command:**
```
npm start
```

## ✅ Endpoints

- `POST /api/create-pix` - Criar pedido Pix
- `POST /api/webhook/connectpay` - Webhook para receber confirmações de pagamento da ConnectPay
- `GET /api/health` - Status do servidor

## 🔔 Configuração do Webhook

Para que os eventos TikTok sejam disparados corretamente apenas quando o pagamento for confirmado:

1. **Configure o webhook no painel da ConnectPay:**
   - Acesse o painel da ConnectPay
   - Vá em "Configurações" → "Webhooks"
   - Adicione a URL: `https://seu-servidor-render.com/api/webhook/connectpay`
   - Ou configure a variável `WEBHOOK_BASE_URL` no Render com a URL base do seu servidor

2. **Variável de Ambiente (Opcional):**
   ```
   WEBHOOK_BASE_URL=https://seu-servidor-render.com
   ```
   Se não configurar, o webhook será usado apenas se `callback_url` for fornecido no `create-pix`.

## 📝 Logs

Verifique os logs no painel do Render para debug.


