import { useMemo, useState } from "react";
import { Printer, X, CheckCircle, Receipt, MessageCircle, Download, Image as ImageIcon } from "lucide-react";
import html2canvas from "html2canvas";
import { formatearMoneda, numeroTicket, salon } from "../../config/salon";
import type { VentaCita } from "./types";
import "./comprobanteTicket.css";

interface ComprobanteTicketModalProps {
  venta: VentaCita;
  montoRecibido?: number;
  recienPagada?: boolean;
  onClose: () => void;
}

const TICKET_PRINT_CSS = `
  @page { size: 80mm auto; margin: 4mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 72mm; }
  .ticket-header-logo { text-align: center; margin-bottom: 6px; }
  .ticket-logo-img { height: 42px; width: auto; }
  .ticket-business-name { font-size: 14px; font-weight: 700; text-align: center; text-transform: uppercase; }
  .ticket-business-info, .ticket-footer { text-align: center; font-size: 11px; }
  .ticket-divider { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .ticket-divider-double { border: none; border-top: 2px dashed #000; margin: 10px 0; }
  .ticket-receipt-title { text-align: center; font-weight: 700; font-size: 13px; text-transform: uppercase; }
  .ticket-meta-grid { display: grid; grid-template-columns: 82px 1fr; gap: 2px 8px; font-size: 11px; }
  .ticket-meta-label { font-weight: 700; }
  .ticket-items-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .ticket-items-table th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; }
  .ticket-items-table td { padding: 4px 0; vertical-align: top; }
  .ticket-text-right { text-align: right; }
  .ticket-text-center { text-align: center; }
  .ticket-discount-tag { display: block; font-size: 10px; }
  .ticket-totals-list { font-size: 11px; }
  .ticket-total-row { display: flex; justify-content: space-between; }
  .ticket-total-main { font-size: 13px; font-weight: 700; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 4px 0; }
  .ticket-legal { text-align: center; font-size: 9px; margin-top: 8px; }
`;

function etiquetaMetodoPago(metodo: VentaCita["metodoPago"]): string {
  switch (metodo) {
    case "efectivo":
      return "EFECTIVO";
    case "tarjeta":
      return "TARJETA";
    case "transferencia":
      return "TRANSFERENCIA";
    case "yape":
      return "YAPE";
    case "plin":
      return "PLIN";
    default:
      return "REGISTRADO";
  }
}

function telefonoWhatsApp(telefono?: string | null): string | null {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 9) return `51${digitos}`;
  if (digitos.length >= 11) return digitos;
  return null;
}

export default function ComprobanteTicketModal({
  venta,
  montoRecibido,
  recienPagada = false,
  onClose,
}: ComprobanteTicketModalProps) {
  const [generandoImagen, setGenerandoImagen] = useState(false);
  
  const total = Math.round(venta.total * 100) / 100;
  const montoEntregado =
    Number(montoRecibido) > 0 ? Math.round(Number(montoRecibido) * 100) / 100 : total;
  const vuelto = Math.max(0, Math.round((montoEntregado - total) * 100) / 100);
  const ticketNro = numeroTicket(venta.id);

  const fechaEmision = venta.fecha ? new Date(venta.fecha) : new Date();
  const fechaTexto = fechaEmision.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const horaTexto = fechaEmision.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const totalServicios = venta.servicios.reduce((sum, s) => sum + s.precio, 0);
  const totalProductos = venta.productos.reduce((sum, p) => sum + p.precioUnitario * p.cantidad, 0);
  const logoAbsoluto = useMemo(
    () => new URL(salon.logoUrl, window.location.origin).href,
    [],
  );

  function imprimirTicket() {
    const ticket = document.getElementById("ticket-imprimible");
    if (!ticket) return;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      window.print();
      return;
    }

    const htmlTicket = ticket.innerHTML.replace(salon.logoUrl, logoAbsoluto);
    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><title>${ticketNro}</title><style>${TICKET_PRINT_CSS}</style></head><body>${htmlTicket}</body></html>`,
    );
    doc.close();

    const imagenes = Array.from(doc.images);
    const esperarImagenes = Promise.all(
      imagenes.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }),
      ),
    );

    void esperarImagenes.then(() => {
      win.focus();
      win.print();
      window.setTimeout(() => iframe.remove(), 800);
    });
  }

  function enviarWhatsApp() {
    const lineas = [
      `*${salon.nombreComercial}*`,
      `Ticket ${ticketNro}`,
      `${fechaTexto} ${horaTexto}`,
      `Cliente: ${venta.clienteNombre || "Clientes varios"}`,
      ...venta.servicios.map((s) => `• ${s.nombre} — S/ ${formatearMoneda(s.precio)}`),
      ...venta.productos.map(
        (p) => `• ${p.nombre} x${p.cantidad} — S/ ${formatearMoneda(p.precioUnitario * p.cantidad)}`,
      ),
      `Total: S/ ${formatearMoneda(total)}`,
      `Pago: ${etiquetaMetodoPago(venta.metodoPago)}`,
      vuelto > 0 ? `Vuelto: S/ ${formatearMoneda(vuelto)}` : "",
      "",
      "Gracias por su preferencia.",
    ].filter(Boolean);

    const texto = encodeURIComponent(lineas.join("\n"));
    const destino = telefonoWhatsApp(venta.clienteTelefono);
    const url = destino
      ? `https://wa.me/${destino}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function generarImagenTicket(): Promise<Blob | null> {
    const elemento = document.getElementById("ticket-imprimible");
    if (!elemento) return null;

    try {
      setGenerandoImagen(true);
      
      // Generar canvas con html2canvas
      const canvas = await html2canvas(elemento, {
        backgroundColor: "#ffffff",
        scale: 2, // Mayor calidad
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      // Convertir a blob
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, "image/png", 0.95);
      });
    } catch (error) {
      console.error("Error al generar imagen:", error);
      return null;
    } finally {
      setGenerandoImagen(false);
    }
  }

  async function descargarComoImagen() {
    const blob = await generarImagenTicket();
    if (!blob) {
      alert("No se pudo generar la imagen del ticket");
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ticket-${ticketNro}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function compartirTicketImagen() {
    const blob = await generarImagenTicket();
    if (!blob) {
      alert("No se pudo generar la imagen del ticket");
      return;
    }

    const file = new File([blob], `ticket-${ticketNro}.png`, { type: "image/png" });

    // Verificar si el navegador soporta Web Share API con archivos
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Ticket ${ticketNro}`,
          text: `Comprobante de pago - ${salon.nombreComercial}`,
          files: [file],
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error al compartir:", error);
          // Fallback: descargar la imagen
          await descargarComoImagen();
        }
      }
    } else {
      // Fallback para navegadores que no soportan compartir archivos
      // Guardamos la imagen y abrimos WhatsApp con texto
      await descargarComoImagen();
      
      const mensaje = encodeURIComponent(
        `Comprobante de pago - ${salon.nombreComercial}\nTicket ${ticketNro}\nTotal: S/ ${formatearMoneda(total)}\n\n(Imagen descargada en tu dispositivo. Por favor adjúntala manualmente)`
      );
      
      const destino = telefonoWhatsApp(venta.clienteTelefono);
      const url = destino
        ? `https://wa.me/${destino}?text=${mensaje}`
        : `https://wa.me/?text=${mensaje}`;
      
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="ticket-modal-overlay" onClick={onClose}>
      <div className="ticket-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="ticket-modal-header">
          <h3>
            <Receipt style={{ width: 20, height: 20, color: "var(--color-accent, #c9a876)" }} />
            Comprobante de Pago
          </h3>
          <button className="btn-icon-close" onClick={onClose} title="Cerrar" type="button">
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {recienPagada && (
          <div className="ticket-success-banner">
            <CheckCircle style={{ width: 18, height: 18 }} />
            Pago registrado. Ya puedes imprimir o enviar el ticket.
          </div>
        )}

        <div className="ticket-modal-body">
          <div className="ticket-paper" id="ticket-imprimible">
            <div className="ticket-header-logo">
              <img src={salon.logoUrl} alt={salon.nombreComercial} className="ticket-logo-img" />
              <div className="ticket-business-name">{salon.nombreComercial}</div>
              <div className="ticket-business-info">
                {salon.razonSocial}
                <br />
                R.U.C. {salon.ruc}
                <br />
                {salon.direccion}
                <br />
                Teléf: {salon.telefono}
              </div>
            </div>

            <hr className="ticket-divider" />

            <div className="ticket-receipt-title">TICKET INTERNO N° {ticketNro}</div>

            <div className="ticket-meta-grid">
              <span className="ticket-meta-label">FECHA:</span>
              <span>
                {fechaTexto} {horaTexto}
              </span>

              <span className="ticket-meta-label">CLIENTE:</span>
              <span>{(venta.clienteNombre || "CLIENTES VARIOS").toUpperCase()}</span>

              {venta.clienteDni && (
                <>
                  <span className="ticket-meta-label">DNI / DOC:</span>
                  <span>{venta.clienteDni}</span>
                </>
              )}

              {venta.citaId && (
                <>
                  <span className="ticket-meta-label">CITA N°:</span>
                  <span>#{venta.citaId}</span>
                </>
              )}

              <span className="ticket-meta-label">CAJERO:</span>
              <span>{(venta.cajeroNombre || "Caja General").toUpperCase()}</span>

              <span className="ticket-meta-label">ESTADO:</span>
              <span>PAGADO</span>
            </div>

            <hr className="ticket-divider" />

            <table className="ticket-items-table">
              <thead>
                <tr>
                  <th style={{ width: "35px" }}>CANT</th>
                  <th>DESCRIPCIÓN</th>
                  <th className="ticket-text-right" style={{ width: "65px" }}>
                    IMPORTE
                  </th>
                </tr>
              </thead>
              <tbody>
                {venta.servicios.map((s, idx) => (
                  <tr key={`s-${s.id}-${idx}`}>
                    <td className="ticket-text-center">1</td>
                    <td>
                      {s.nombre.toUpperCase()}
                      {Boolean(s.descuentoPorcentaje) && (
                        <span className="ticket-discount-tag">
                          (Promo: -{s.descuentoPorcentaje}%)
                        </span>
                      )}
                    </td>
                    <td className="ticket-text-right">S/ {formatearMoneda(s.precio)}</td>
                  </tr>
                ))}

                {venta.productos.map((p, idx) => (
                  <tr key={`p-${p.id}-${idx}`}>
                    <td className="ticket-text-center">{p.cantidad}</td>
                    <td>
                      {p.nombre.toUpperCase()}
                      <span className="ticket-unit-price">@{formatearMoneda(p.precioUnitario)} c/u</span>
                    </td>
                    <td className="ticket-text-right">
                      S/ {formatearMoneda(p.precioUnitario * p.cantidad)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <hr className="ticket-divider" />

            <div className="ticket-totals-list">
              {totalServicios > 0 && (
                <div className="ticket-total-row">
                  <span>Servicios:</span>
                  <span>S/ {formatearMoneda(totalServicios)}</span>
                </div>
              )}
              {totalProductos > 0 && (
                <div className="ticket-total-row">
                  <span>Productos:</span>
                  <span>S/ {formatearMoneda(totalProductos)}</span>
                </div>
              )}

              <div className="ticket-total-row ticket-total-main">
                <span>TOTAL:</span>
                <span>S/ {formatearMoneda(total)}</span>
              </div>

              <div className="ticket-total-row">
                <span>FORMA DE PAGO:</span>
                <span style={{ fontWeight: 600 }}>{etiquetaMetodoPago(venta.metodoPago)}</span>
              </div>

              <div className="ticket-total-row">
                <span>IMPORTE RECIBIDO:</span>
                <span>S/ {formatearMoneda(montoEntregado)}</span>
              </div>

              {vuelto > 0 && (
                <div className="ticket-total-row" style={{ fontWeight: 600 }}>
                  <span>VUELTO:</span>
                  <span>S/ {formatearMoneda(vuelto)}</span>
                </div>
              )}
            </div>

            <hr className="ticket-divider-double" />

            <div className="ticket-footer">
              <p>¡GRACIAS POR SU PREFERENCIA!</p>
              <p>Documento interno de caja. No sustituye boleta ni factura SUNAT.</p>
              <p>{salon.web}</p>
            </div>
          </div>
        </div>

        <div className="ticket-modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cerrar
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={descargarComoImagen}
            disabled={generandoImagen}
            title="Descargar ticket como imagen PNG"
          >
            <Download style={{ width: 18, height: 18 }} />
            Descargar PNG
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={compartirTicketImagen}
            disabled={generandoImagen}
            title="Compartir ticket como imagen por WhatsApp"
          >
            {generandoImagen ? (
              <span style={{ animation: "spin 1s linear infinite" }}>⏳</span>
            ) : (
              <ImageIcon style={{ width: 18, height: 18 }} />
            )}
            WhatsApp Imagen
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={enviarWhatsApp}
            title="Enviar texto por WhatsApp"
          >
            <MessageCircle style={{ width: 18, height: 18 }} />
            WhatsApp Texto
          </button>
          <button className="btn btn-primary" type="button" onClick={imprimirTicket}>
            <Printer style={{ width: 18, height: 18 }} />
            Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  );
}
