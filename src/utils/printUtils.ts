import { PRINT_SIZES } from '../types/timetable';

declare global {
  interface Window {
    AndroidPrint?: {
      printPage?: () => void;
    };
  }
}

export function triggerPrint(
  htmlContent: string,
  options: {
    printSize?: 'xs' | 's' | 'm' | 'l' | 'xl';
    orientation?: 'landscape' | 'portrait';
  } = {}
) {
  const printArea = document.getElementById('printArea');
  if (!printArea) return;

  const sizeKey = options.printSize || 'm';
  const mult = (PRINT_SIZES[sizeKey] || PRINT_SIZES.m).mult;

  // Configure orientation style
  const styleId = 'dynamicPrintPage';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const isPortrait = options.orientation === 'portrait';
  const pageSize = isPortrait ? 'A4 portrait' : 'A4 landscape';
  styleEl.textContent = `
    @media print {
      @page {
        size: ${pageSize};
        margin: 8mm;
      }
      #printArea {
        --mult: ${mult};
      }
    }
  `;

  printArea.innerHTML = htmlContent;
  printArea.style.display = 'block';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (window.AndroidPrint && typeof window.AndroidPrint.printPage === 'function') {
          window.AndroidPrint.printPage();
        } else {
          window.print();
        }
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        setTimeout(() => {
          printArea.innerHTML = '';
          printArea.style.display = 'none';
        }, 1500);
      }
    });
  });
}
