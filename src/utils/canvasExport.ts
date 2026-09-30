import { TimetableData, DAY_NAMES } from '../types/timetable';

declare global {
  interface Window {
    AndroidShare?: {
      shareBase64Image?: (b64: string, fileName: string, title: string) => void;
    };
    AndroidImage?: {
      saveBase64Image?: (b64: string, fileName: string) => void;
    };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width <= maxW) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const lines = wrapText(ctx, text, maxW);
  const totalH = lines.length * lineH;
  const startY = y - totalH / 2 + lineH * 0.8;
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineH));
}

function drawLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const lines = wrapText(ctx, text, maxW);
  const totalH = lines.length * lineH;
  const startY = y - totalH / 2 + lineH * 0.8;
  ctx.textAlign = "left";
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineH));
  ctx.textAlign = "center";
}

function daysLabel(days: number[]): string {
  if (!Array.isArray(days) || !days.length) return "";
  return days.slice().sort((a, b) => a - b).map(d => (DAY_NAMES[d] || "").slice(0, 3)).join(", ");
}

export async function createTimetableCanvas(
  kind: 'whole' | 'allteachers' | 'class' | 'teacher' | 'timings' | 'substitute' | 'freestaff' | 'roster',
  data: TimetableData,
  options: {
    selectedClass?: string;
    selectedTeacher?: string;
    absentTeacher?: string;
    teacherPeriodSummary: (teacher: string, periodIndex: number) => string;
    teacherTotalPeriods: (teacher: string) => number;
    getLeavesForDate: (date: string) => string[];
  }
): Promise<HTMLCanvasElement> {
  const scale = 2;
  const F = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const hasBreak = data.breakAfter && data.breakAfter > 0 && data.breakAfter < data.periods.length;

  let logoImg: HTMLImageElement | null = null;
  if (data.schoolLogo) {
    try {
      logoImg = await loadImage(data.schoolLogo);
    } catch {
      // Ignore logo error
    }
  }

  function drawPageHeader(ctx: CanvasRenderingContext2D, totalW: number, pad: number, headerH: number, title: string) {
    let hx = pad;
    if (logoImg) {
      const lw = 80;
      const lh = Math.min(80, (lw * logoImg.height) / logoImg.width);
      ctx.drawImage(logoImg, pad, pad + (headerH - lh) / 2 - 10, lw, lh);
      hx = pad + lw + 16;
    }
    const cx = (hx + totalW - pad) / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = "#1B4D3E";
    ctx.font = `700 24px ${F}`;
    ctx.fillText(data.schoolName, cx, pad + 28);
    ctx.font = `600 13px ${F}`;
    ctx.fillStyle = "#4B5563";
    ctx.fillText(title, cx, pad + 62);
    ctx.fillStyle = "#000000";
  }

  // 1. Whole School Timetable
  if (kind === "whole") {
    const n = data.periods.length;
    const pad = 30;
    const headerH = 140;
    const headRowH = 50;
    const rowH = 66;
    const classW = 120;
    const inchargeW = 120;
    const periodW = 110;
    const tableW = classW + inchargeW + periodW * n;

    const totalW = pad * 2 + tableW;
    const totalH = pad * 2 + headerH + headRowH + data.classes.length * rowH;

    const canvas = document.createElement("canvas");
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, totalW, totalH);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const subtitle = [data.academicYear, data.wholeTitle].filter(Boolean).join(" • ");
    drawPageHeader(ctx, totalW, pad, headerH, subtitle);

    let y = pad + headerH;
    let x = pad;
    ctx.fillStyle = "#EFEBE2";
    ctx.fillRect(pad, y, tableW, headRowH);
    ctx.strokeStyle = "#DAD3C3";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, classW, headRowH);
    ctx.fillStyle = "#1B4D3E";
    ctx.font = `700 13px ${F}`;
    ctx.fillText("Class", x + classW / 2, y + headRowH / 2);
    x += classW;
    ctx.strokeRect(x, y, inchargeW, headRowH);
    ctx.fillText("Incharge", x + inchargeW / 2, y + headRowH / 2);
    x += inchargeW;

    data.periods.forEach(p => {
      ctx.strokeRect(x, y, periodW, headRowH);
      ctx.fillText(`Period ${p}`, x + periodW / 2, y + headRowH / 2);
      x += periodW;
    });
    y += headRowH;

    data.classes.forEach((c, ci) => {
      x = pad;
      ctx.fillStyle = ci % 2 === 0 ? "#FFFFFF" : "#F8F5EE";
      ctx.fillRect(pad, y, tableW, rowH);
      ctx.strokeStyle = "#DAD3C3";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, classW, rowH);
      ctx.fillStyle = "#111827";
      ctx.font = `700 13px ${F}`;
      ctx.fillText(c[0], x + classW / 2, y + rowH / 2);
      x += classW;
      ctx.strokeRect(x, y, inchargeW, rowH);
      ctx.font = `600 12px ${F}`;
      ctx.fillText(c[1] || "—", x + inchargeW / 2, y + rowH / 2);
      x += inchargeW;

      data.periods.forEach((_, pi) => {
        ctx.strokeRect(x, y, periodW, rowH);
        const s2 = c[5] ? c[5][pi] : null;
        const t1 = c[4][pi];
        const sub1 = c[3][pi] || "—";
        let line1 = t1 ? `${sub1} - ${t1}` : sub1;
        let line2 = "";

        if (s2 && (s2.subject || s2.teacher)) {
          if (s2.mode === "parallel") {
            line2 = s2.teacher ? `${s2.subject || "—"} - ${s2.teacher}` : s2.subject || "—";
          } else if (s2.mode === "same") {
            const t = t1 || s2.teacher;
            const dayStr = s2.days && s2.days.length > 0 ? ` (${daysLabel(s2.days)})` : "";
            line1 = t ? `${sub1}/${s2.subject || "—"}${dayStr} - ${t}` : `${sub1}/${s2.subject || "—"}${dayStr}`;
            line2 = "";
          } else {
            line2 = s2.teacher ? `${s2.subject || "—"} - ${s2.teacher} (${daysLabel(s2.days)})` : `${s2.subject || "—"} (${daysLabel(s2.days)})`;
          }
        }

        ctx.fillStyle = "#111827";
        ctx.font = `700 10.5px ${F}`;
        if (line2) {
          drawCentered(ctx, line1, x + periodW / 2, y + rowH / 2 - 11, periodW - 8, 12);
          drawCentered(ctx, line2, x + periodW / 2, y + rowH / 2 + 11, periodW - 8, 12);
        } else {
          drawCentered(ctx, line1, x + periodW / 2, y + rowH / 2, periodW - 8, 12);
        }
        x += periodW;
      });
      y += rowH;
    });

    return canvas;
  }

  // 2. Class Wise Timetable
  if (kind === "class") {
    const c = data.classes.find(x => x[0] === options.selectedClass) || data.classes[0];
    if (!c) throw new Error("No class selected");
    const n = data.periods.length;
    const pad = 30;
    const headerH = 110;
    const dayColW = 100;
    const periodColW = 130;
    const breakColW = 50;
    const headRowH = 40;
    const rowH = 74;

    const totalW = pad * 2 + dayColW + n * periodColW + (hasBreak ? breakColW : 0);
    const totalH = pad * 2 + headerH + headRowH + data.days.length * rowH;

    const canvas = document.createElement("canvas");
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, totalW, totalH);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const inchargePart = c[1] ? " — Incharge: " + c[1] : "";
    const subtitle = [data.academicYear, c[0] + inchargePart].filter(Boolean).join(" • ");
    drawPageHeader(ctx, totalW, pad, headerH, subtitle);

    let y = pad + headerH;
    let x = pad;
    ctx.fillStyle = "#EFEBE2";
    ctx.fillRect(pad, y, totalW - pad * 2, headRowH);
    ctx.strokeStyle = "#DAD3C3";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, dayColW, headRowH);
    ctx.fillStyle = "#1B4D3E";
    ctx.font = `700 13px ${F}`;
    ctx.fillText("Day", x + dayColW / 2, y + headRowH / 2);
    x += dayColW;

    data.periods.forEach(p => {
      ctx.strokeRect(x, y, periodColW, headRowH);
      ctx.font = `700 12px ${F}`;
      ctx.fillText(`Period ${p}`, x + periodColW / 2, y + headRowH / 2);
      x += periodColW;
      if (hasBreak && data.breakAfter === p) {
        ctx.strokeRect(x, y, breakColW, headRowH);
        x += breakColW;
      }
    });
    y += headRowH;

    data.days.forEach((d, dayIdx) => {
      let cx2 = pad;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(pad, y, totalW - pad * 2, rowH);
      ctx.strokeRect(cx2, y, dayColW, rowH);
      ctx.fillStyle = "#111827";
      ctx.font = `700 13px ${F}`;
      drawCentered(ctx, d, cx2 + dayColW / 2, y + rowH / 2, dayColW - 10, 15);
      cx2 += dayColW;

      data.periods.forEach((p, i) => {
        ctx.strokeRect(cx2, y, periodColW, rowH);
        const s2 = c[5] ? c[5][i] : null;
        const t1 = c[4][i];
        const sub1 = c[3][i] || "—";
        let line = t1 ? `${sub1} - ${t1}` : sub1;

        if (s2 && (s2.subject || s2.teacher)) {
          if (s2.mode === "same") {
            const t = t1 || s2.teacher;
            line = t ? `${sub1}/${s2.subject || "—"} - ${t}` : `${sub1}/${s2.subject || "—"}`;
          } else if (s2.mode === "parallel" || s2.days.includes(dayIdx)) {
            line = `${sub1}${t1 ? " - " + t1 : ""} / ${s2.subject || ""}${s2.teacher ? " - " + s2.teacher : ""}`;
          }
        }

        ctx.fillStyle = "#111827";
        ctx.font = `700 11.5px ${F}`;
        drawCentered(ctx, line, cx2 + periodColW / 2, y + rowH / 2, periodColW - 10, 13);
        cx2 += periodColW;

        if (hasBreak && data.breakAfter === p) {
          if (dayIdx === 0) {
            const bh = data.days.length * rowH;
            ctx.fillStyle = "#EFEBE2";
            ctx.fillRect(cx2, y, breakColW, bh);
            ctx.strokeRect(cx2, y, breakColW, bh);
            ctx.save();
            ctx.translate(cx2 + breakColW / 2, y + bh / 2);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = "#1B4D3E";
            ctx.font = `700 14px ${F}`;
            ctx.fillText("BREAK", 0, 0);
            ctx.restore();
          }
          cx2 += breakColW;
        }
      });
      y += rowH;
    });

    return canvas;
  }

  // 3. Teacher Timetable
  const t = options.selectedTeacher || data.teachers[0];
  const inchargeClass = data.classes.find(c => c[1] === t);
  const info = (data.teacherInfo && data.teacherInfo[t]) || { qual: "", rank: "", desig: "" };
  const subParts = [
    data.academicYear,
    inchargeClass ? "Incharge of " + inchargeClass[0] : "",
    info.rank,
    info.qual,
    t
  ].filter(Boolean);
  const subtitle = subParts.join(" • ");

  const pad = 30;
  const headerH = 110;
  const rowH = 60;
  const headRowH = 40;
  const periodColW = 180;
  const assignColW = 560;

  const totalW = pad * 2 + periodColW + assignColW;
  const totalH = pad * 2 + headerH + headRowH + data.periods.length * rowH;

  const canvas = document.createElement("canvas");
  canvas.width = totalW * scale;
  canvas.height = totalH * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, totalW, totalH);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  drawPageHeader(ctx, totalW, pad, headerH, subtitle);

  let y = pad + headerH;
  ctx.fillStyle = "#EFEBE2";
  ctx.fillRect(pad, y, periodColW + assignColW, headRowH);
  ctx.strokeStyle = "#DAD3C3";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, y, periodColW, headRowH);
  ctx.strokeRect(pad + periodColW, y, assignColW, headRowH);
  ctx.fillStyle = "#1B4D3E";
  ctx.font = `700 14px ${F}`;
  ctx.fillText("Period", pad + periodColW / 2, y + headRowH / 2);
  ctx.fillText("Assignment", pad + periodColW + assignColW / 2, y + headRowH / 2);
  y += headRowH;

  data.periods.forEach((p, i) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(pad, y, periodColW + assignColW, rowH);
    ctx.strokeRect(pad, y, periodColW, rowH);
    ctx.strokeRect(pad + periodColW, y, assignColW, rowH);
    ctx.fillStyle = "#111827";
    ctx.font = `700 13px ${F}`;
    ctx.fillText(`Period ${p}`, pad + periodColW / 2, y + rowH / 2);
    const cellText = options.teacherPeriodSummary(t, i);
    drawCentered(ctx, cellText, pad + periodColW + assignColW / 2, y + rowH / 2, assignColW - 20, 16);
    y += rowH;
  });

  return canvas;
}

export async function shareOrDownloadCanvas(
  canvas: HTMLCanvasElement,
  fileName: string,
  title: string
): Promise<boolean> {
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/png"));
  if (!blob) return false;

  // 1. Android APK Bridge check
  if (window.AndroidShare && typeof window.AndroidShare.shareBase64Image === "function") {
    const reader = new FileReader();
    reader.onload = function () {
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      const b64 = i >= 0 ? s.slice(i + 1) : s;
      window.AndroidShare?.shareBase64Image?.(b64, fileName, title);
    };
    reader.readAsDataURL(blob);
    return true;
  }

  // 2. Web Share API
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch {
      // Fall through to download if cancelled or unsupported
    }
  }

  // 3. Fallback: Save to pictures via Android bridge or browser download
  if (window.AndroidImage && typeof window.AndroidImage.saveBase64Image === "function") {
    const reader = new FileReader();
    reader.onload = function () {
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      const b64 = i >= 0 ? s.slice(i + 1) : s;
      window.AndroidImage?.saveBase64Image?.(b64, fileName);
    };
    reader.readAsDataURL(blob);
    return true;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return true;
}
