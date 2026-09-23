# ComboxBanks - Panel Multibanca en Tiempo Real

Panel de control financiero minimalista para consultar y gestionar en tiempo real los saldos en Bolívares (Bs.) y Dólares ($) de tus cuentas bancarias y billeteras (BDV, Banesco, BNC, Binance) con tasas oficiales BCV y Binance P2P.

## 🚀 Despliegue en GitHub Pages

El proyecto ya está 100% configurado para funcionar de forma estática en **GitHub Pages**.

### Pasos para publicar:

1. **Subir el código a tu repositorio de GitHub**:
   ```bash
   git add .
   git commit -m "feat: Preparado para GitHub Pages"
   git push origin main
   ```

2. **Activar GitHub Pages en el repositorio**:
   - Ve a tu repositorio en GitHub.
   - Haz clic en **Settings** (Configuración) > **Pages**.
   - En **Build and deployment** > **Source**, selecciona: **GitHub Actions**.

3. ¡Listo! El workflow automático (`.github/workflows/deploy.yml`) compilará y desplegará la aplicación en segundos en:
   `https://<tu-usuario>.github.io/<nombre-del-repositorio>/`

---

## ⚡ Características

- **Tasas oficiales en tiempo real:** Consulta directa a Google Apps Script para tasas BCV USD, EUR y fecha valor.
- **Tasa Binance P2P:** Consulta en vivo de la cotización P2P USDT/VES.
- **Edición de saldos con Webhook:** Al tocar cualquier tarjeta bancaria puedes editar el saldo y enviar el webhook a Google Apps Script (`?banco=...&monto=...`).
- **Bloqueo de protección de 30 segundos:** Previene saturación y disparos repetidos de sincronización.
- **Base relativa (`./`):** Compatible con cualquier subdirectorio en GitHub Pages o dominio personalizado.
