import React, { useState } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { exportTimetableToExcel } from '../utils/excelExport';
import { triggerPrint } from '../utils/printUtils';
import { PRINT_SIZES, DAY_NAMES } from '../types/timetable';
import {
  Printer,
  FileSpreadsheet,
  Settings,
  Scissors,
  Users,
  Calendar,
  Download
} from 'lucide-react';

function buildPrintHeader(schoolName: string, title: string, subtitle: string, logo: string): string {
  const logoHtml = logo
    ? `<div style="flex:0 0 26mm; max-width:26mm; display:flex; align-items:center; justify-content:center;">
         <img src="${logo}" alt="" style="max-height:20mm; max-width:26mm; display:block;" />
       </div>`
    : '';
  const spacerHtml = logo
    ? `<div style="flex:0 0 26mm; max-width:26mm; visibility:hidden;"></div>`
    : '';
  return `
    <div style="display:flex; align-items:center; gap:4mm; margin-bottom:4mm;">
      ${logoHtml}
      <div style="flex:1; text-align:center; min-width:0;">
        <h2 style="margin:0; font-size:18pt; font-weight:700;">${schoolName}</h2>
        <div style="font-size:12pt; font-weight:700; margin-top:1mm;">${title}</div>
        ${subtitle ? `<div style="font-size:10pt; color:#555; margin-top:1mm;">${subtitle}</div>` : ''}
      </div>
      ${spacerHtml}
    </div>
  `;
}

export const PrintingView: React.FC = () => {
  const {
    data,
    updateData,
    teacherPeriodSummary,
    getTeacherTotalPeriods,
    getLeavesForDate
  } = useTimetable();

  // Absent teacher is chosen in Substitute tab. We don't have it here, so
  // read from wherever the user last left it. If not set → skip Substitute sheet.
  const absentTeacher = localStorage.getItem("utAbsentTeacher") || "";

  const [printSize, setPrintSize] = useState<'xs' | 's' | 'm' | 'l' | 'xl'>(data.printSize || 'm');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(data.printOrientation || 'landscape');
  const [selectedTeacher, setSelectedTeacher] = useState<string>(data.teachers[0] || "");
  const [selectedClass, setSelectedClass] = useState<string>(data.classes[0]?.[0] || "");
  const [teacherGridLayout, setTeacherGridLayout] = useState<string>("4x2");
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  const metaLine = [data.academicYear, data.printNote].filter(Boolean).join(" · ");

  const handlePrintWholeSchool = () => {
    const headRow = `<tr><th style="padding: 6px; border: 1px solid #000;">Class</th><th style="padding: 6px; border: 1px solid #000;">Incharge</th>${data.periods.map(p => `<th style="padding: 6px; border: 1px solid #000; text-align: center;">Period ${p}</th>`).join("")}</tr>`;

    let bodyRows = "";
    data.classes.forEach(c => {
      const cells = data.periods.map((_, pi) => {
        const sub = c[3][pi] || "—";
        const tea = c[4][pi];
        const s2 = c[5] ? c[5][pi] : null;
        let line = sub;
        if (s2 && s2.mode === 'same') {
          const t = tea || s2.teacher;
          const dayStr = s2.days && s2.days.length > 0 ? ` (${s2.days.map((d: number) => (DAY_NAMES[d] || "").slice(0, 3)).join(", ")})` : '';
          line = `${sub}/${s2.subject || "—"}${dayStr}${t ? ` - ${t}` : ''}`;
        } else {
          if (tea) line += ` - ${tea}`;
          if (s2 && (s2.subject || s2.teacher)) {
            line += ` / ${s2.subject || ""}${s2.teacher && s2.mode !== 'same' ? ` - ${s2.teacher}` : ''}`;
          }
        }
        return `<td style="padding: 5px; border: 1px solid #000; text-align: center; font-size: 9.5pt;">${line}</td>`;
      }).join("");

      bodyRows += `<tr><th style="padding: 5px; border: 1px solid #000; text-align: left;">${c[0]}</th><td style="padding: 5px; border: 1px solid #000;">${c[1] || "—"}</td>${cells}</tr>`;
    });

    const content = `
      <div class="print-sheet" style="font-family: sans-serif; padding: 10mm;">
        ${buildPrintHeader(data.schoolName, data.wholeTitle, metaLine, data.schoolLogo)}
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead style="background: #e5e7eb;">${headRow}</thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    `;

    triggerPrint(content, { printSize, orientation: 'landscape' });
  };

  const handlePrintAllTeachers = () => {
    const headRow = `<tr><th style="padding: 6px; border: 1px solid #000; text-align: left; width: 18%;">Teacher</th>${data.periods.map(p => `<th style="padding: 6px; border: 1px solid #000; text-align: center;">Period ${p}</th>`).join("")}</tr>`;

    const teacherList = data.hideEmptyTeachersInTT
      ? data.teachers.filter(t => getTeacherTotalPeriods(t) > 0)
      : data.teachers;

    const rows = teacherList.map(t => {
      const cells = data.periods.map((_, pi) => {
        return `<td style="padding: 5px; border: 1px solid #000; text-align: center; font-size: 9pt;">${teacherPeriodSummary(t, pi)}</td>`;
      }).join("");

      return `<tr><th style="padding: 5px; border: 1px solid #000; text-align: left;">${t}</th>${cells}</tr>`;
    }).join("");

    const content = `
      <div class="print-sheet" style="font-family: sans-serif; padding: 10mm;">
        ${buildPrintHeader(data.schoolName, data.allTeachersTitle, metaLine, data.schoolLogo)}
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead style="background: #e5e7eb;">${headRow}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    triggerPrint(content, { printSize, orientation: 'landscape' });
  };

  const handlePrintTeacherGrid = () => {
    const [cols, rows] = teacherGridLayout.split("x").map(Number);
    const perPage = cols * rows;
    const teachers = data.hideEmptyTeachersInTT
      ? data.teachers.filter(t => getTeacherTotalPeriods(t) > 0)
      : data.teachers;

    let pagesHtml = "";

    for (let i = 0; i < teachers.length; i += perPage) {
      const pageTeachers = teachers.slice(i, i + perPage);
      let boxes = "";

      pageTeachers.forEach(t => {
        const periodRows = data.periods.map((p, pi) => `
          <tr style="height: 1px;">
            <td style="padding: 2px 4px; border: 1px solid #999; font-size: 8pt; font-weight: bold; text-align: center; width: 22%;">P${p}</td>
            <td style="padding: 2px 4px; border: 1px solid #999; font-size: 8pt; text-align: left;">${teacherPeriodSummary(t, pi)}</td>
          </tr>
        `).join("");

        boxes += `
          <div style="border: 1px dashed #000; padding: 2mm; box-sizing: border-box; display: flex; flex-direction: column; background: #fff;">
            <div style="text-align: center; font-weight: bold; font-size: 10pt; border-bottom: 1px solid #000; padding-bottom: 1mm; margin-bottom: 1.5mm;">
              ${t}
            </div>
            <table style="width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed;">
              <tbody>${periodRows}</tbody>
            </table>
          </div>
        `;
      });

      pagesHtml += `
        <div class="print-sheet" style="padding: 6mm; box-sizing: border-box; page-break-after: always;">
          <div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr); gap: 4mm; height: 185mm;">
            ${boxes}
          </div>
        </div>
      `;
    }

    triggerPrint(pagesHtml, { orientation: 'landscape' });
  };

  const handlePrintClassroom = () => {
    const c = data.classes.find(x => x[0] === selectedClass) || data.classes[0];
    if (!c) return;

    const headRow = `<tr><th style="padding: 6px; border: 1px solid #000;">Day</th>${data.periods.map(p => `<th style="padding: 6px; border: 1px solid #000; text-align: center;">Period ${p}</th>`).join("")}</tr>`;

    const bodyRows = data.days.map((d, dayIdx) => {
      const cells = data.periods.map((_, pi) => {
        const s2 = c[5] ? c[5][pi] : null;
        const t1 = c[4][pi];
        const sub1 = c[3][pi] || "—";
        let line = t1 ? `${sub1} - ${t1}` : sub1;

        if (s2 && (s2.subject || s2.teacher)) {
          if (s2.mode === 'same') {
            const t = t1 || s2.teacher;
            line = t ? `${sub1}/${s2.subject || "—"} - ${t}` : `${sub1}/${s2.subject || "—"}`;
          } else if (s2.mode === 'parallel' || s2.days.includes(dayIdx)) {
            line = `${sub1}${t1 ? " - " + t1 : ""} / ${s2.subject || ""}${s2.teacher ? " - " + s2.teacher : ""}`;
          }
        }
        return `<td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 10pt;">${line}</td>`;
      }).join("");

      return `<tr><th style="padding: 8px; border: 1px solid #000; text-align: left;">${d}</th>${cells}</tr>`;
    }).join("");

    const title = `${c[0]} Timetable ${c[1] ? `(Incharge: ${c[1]})` : ''}`;
    const content = `
      <div class="print-sheet" style="font-family: sans-serif; padding: 10mm;">
        ${buildPrintHeader(data.schoolName, title, metaLine, data.schoolLogo)}
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead style="background: #e5e7eb;">${headRow}</thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    `;

    triggerPrint(content, { printSize, orientation: 'landscape' });
  };

  const handlePrintAllClassrooms = () => {
    let sheets = "";
    data.classes.forEach(c => {
      const headRow = `<tr><th style="padding: 6px; border: 1px solid #000;">Day</th>${data.periods.map(p => `<th style="padding: 6px; border: 1px solid #000; text-align: center;">Period ${p}</th>`).join("")}</tr>`;

      const bodyRows = data.days.map((d, dayIdx) => {
        const cells = data.periods.map((_, pi) => {
          const s2 = c[5] ? c[5][pi] : null;
          const t1 = c[4][pi];
          const sub1 = c[3][pi] || "—";
          let line = t1 ? `${sub1} - ${t1}` : sub1;

          if (s2 && (s2.subject || s2.teacher)) {
            if (s2.mode === 'same') {
              const t = t1 || s2.teacher;
              line = t ? `${sub1}/${s2.subject || "—"} - ${t}` : `${sub1}/${s2.subject || "—"}`;
            } else if (s2.mode === 'parallel' || s2.days.includes(dayIdx)) {
              line = `${sub1}${t1 ? " - " + t1 : ""} / ${s2.subject || ""}${s2.teacher ? " - " + s2.teacher : ""}`;
            }
          }
          return `<td style="padding: 8px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 10pt;">${line}</td>`;
        }).join("");

        return `<tr><th style="padding: 8px; border: 1px solid #000; text-align: left;">${d}</th>${cells}</tr>`;
      }).join("");

      const title = `${c[0]} Timetable ${c[1] ? `(Incharge: ${c[1]})` : ''}`;
      sheets += `
        <div class="print-sheet" style="font-family: sans-serif; padding: 10mm; page-break-after: always;">
          ${buildPrintHeader(data.schoolName, title, metaLine, data.schoolLogo)}
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead style="background: #e5e7eb;">${headRow}</thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      `;
    });

    triggerPrint(sheets, { printSize, orientation: 'landscape' });
  };

  const handleDownloadExcel = async () => {
    setIsExportingExcel(true);
    try {
      await exportTimetableToExcel(
        data,
        teacherPeriodSummary,
        getTeacherTotalPeriods,
        absentTeacher,
        getLeavesForDate
      );
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Failed to generate Excel workbook.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-emerald-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-emerald-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-800 text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Full Excel Export
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Export Complete Workbook (.xlsx)
            </h2>
            <p className="text-xs text-emerald-200 leading-relaxed max-w-xl">
              Generates a real, multi-tab Microsoft Excel file offline. Includes Whole School, All Teachers, each Class sheet, Timings, Roster, and Free Staff on separate worksheets.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExportingExcel}
            className="min-h-[46px] px-5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 active:scale-95 shrink-0"
          >
            <Download className="w-4 h-4 text-emerald-800" />
            <span>{isExportingExcel ? "Generating .xlsx..." : "Download Excel (.xlsx)"}</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-stone-200 dark:border-stone-800">
          <Settings className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
            Print Geometry &amp; Sizing
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              Print Scaling
            </label>
            <select
              value={printSize}
              onChange={(e) => {
                const val = e.target.value as any;
                setPrintSize(val);
                updateData(prev => ({ ...prev, printSize: val }));
              }}
              className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-semibold"
            >
              {Object.keys(PRINT_SIZES).map(k => (
                <option key={k} value={k}>{PRINT_SIZES[k].label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              Page Orientation
            </label>
            <select
              value={orientation}
              onChange={(e) => {
                const val = e.target.value as any;
                setOrientation(val);
                updateData(prev => ({ ...prev, printOrientation: val }));
              }}
              className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-semibold"
            >
              <option value="landscape">Landscape (Recommended for A4)</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Complete School Sheets
            </h4>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handlePrintWholeSchool}
              className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-between"
            >
              <span>Whole School Master Timetable</span>
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handlePrintAllTeachers}
              className="w-full py-2.5 px-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition flex items-center justify-between"
            >
              <span>All Teachers Wise Timetable</span>
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handlePrintAllClassrooms}
              className="w-full py-2.5 px-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold transition flex items-center justify-between"
            >
              <span>All Classrooms (1 page each)</span>
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-emerald-700" />
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Cut-Out Teacher Strips
            </h4>
          </div>
          <p className="text-xs text-stone-500">
            Compact individual timetable boxes with dashed lines ready for cutting.
          </p>

          <div className="flex gap-2">
            <select
              value={teacherGridLayout}
              onChange={(e) => setTeacherGridLayout(e.target.value)}
              className="flex-1 px-3 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-bold"
            >
              <option value="4x2">4 × 2 (8 teachers per A4 page)</option>
              <option value="3x2">3 × 2 (6 teachers per A4 page)</option>
              <option value="2x2">2 × 2 (4 teachers per A4 page)</option>
            </select>

            <button
              type="button"
              onClick={handlePrintTeacherGrid}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3 sm:col-span-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-700" />
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Single Classroom or Teacher Print
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                Select Class
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="flex-1 px-3 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-bold"
                >
                  {data.classes.map(c => (
                    <option key={c[0]} value={c[0]}>{c[0]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handlePrintClassroom}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                Select Teacher
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="flex-1 px-3 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-bold"
                >
                  {data.teachers.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const info = data.teacherInfo[selectedTeacher] || { qual: "", rank: "", desig: "" };
                    const subParts = [
                      data.academicYear,
                      info.rank,
                      info.qual,
                      data.printNote
                    ].filter(Boolean).join(" · ");

                    const content = `
                      <div class="print-sheet" style="font-family: sans-serif; padding: 10mm;">
                        ${buildPrintHeader(data.schoolName, `${selectedTeacher} Timetable`, subParts, data.schoolLogo)}
                        <table style="width: 100%; border-collapse: collapse;">
                          <thead>
                            <tr style="background: #e5e7eb;">
                              <th style="padding: 8px; border: 1px solid #000; width: 30%;">Period</th>
                              <th style="padding: 8px; border: 1px solid #000; text-align: left;">Class &amp; Subject Assignment</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${data.periods.map((p, pi) => `
                              <tr>
                                <th style="padding: 8px; border: 1px solid #000;">Period ${p}</th>
                                <td style="padding: 8px; border: 1px solid #000; font-size: 11pt; font-weight: bold;">
                                  ${teacherPeriodSummary(selectedTeacher, pi)}
                                </td>
                              </tr>
                            `).join("")}
                          </tbody>
                        </table>
                      </div>
                    `;
                    triggerPrint(content, { printSize, orientation: 'portrait' });
                  }}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};