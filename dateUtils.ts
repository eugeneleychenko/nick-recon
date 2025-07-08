/**
 * Date utility functions for standardizing dates across different formats
 * Ported from Python standardize_date function (lines 44-75)
 */

/**
 * Function to standardize date format to MM/DD/YYYY
 * Convert various date formats to MM/DD/YYYY
 */
export function standardizeDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "NULL" || dateStr === "" || dateStr === null || dateStr === undefined) {
    return "";
  }
  
  try {
    // Common date formats to try
    const dateFormats = [
      { regex: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, format: "YYYY-MM-DD HH:mm:ss" }, // 2025-04-07 0:00:00
      { regex: /^\d{4}-\d{2}-\d{2}$/, format: "YYYY-MM-DD" }, // 2025-04-07
      { regex: /^\d{2}\/\d{2}\/\d{4}$/, format: "MM/DD/YYYY" }, // 04/07/2025
      { regex: /^\d{2}\/\d{2}\/\d{2}$/, format: "MM/DD/YY" }, // 04/07/25
      { regex: /^\d{2}\/\d{2}\/\d{4}$/, format: "DD/MM/YYYY" }, // 07/04/2025
      { regex: /^\d{2}-\d{2}-\d{4}$/, format: "MM-DD-YYYY" }, // 04-07-2025
      { regex: /^\d{2}-\d{2}-\d{4}$/, format: "DD-MM-YYYY" }, // 07-04-2025
    ];
    
    const trimmedDateStr = dateStr.toString().trim();
    
    // Try parsing with different formats
    for (const { regex, format } of dateFormats) {
      if (regex.test(trimmedDateStr)) {
        const parsedDate = parseDate(trimmedDateStr, format);
        if (parsedDate) {
          return formatDate(parsedDate);
        }
      }
    }
    
    // Try with built-in Date parsing as fallback
    const parsedDate = new Date(trimmedDateStr);
    if (!isNaN(parsedDate.getTime())) {
      return formatDate(parsedDate);
    }
    
    // Try parsing month names
    const monthNameFormats = [
      /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/, // April 7, 2025
      /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/, // Apr 7, 2025
    ];
    
    for (const regex of monthNameFormats) {
      const match = trimmedDateStr.match(regex);
      if (match) {
        const monthName = match[1];
        const day = parseInt(match[2]);
        const year = parseInt(match[3]);
        
        const monthIndex = getMonthIndex(monthName);
        if (monthIndex !== -1) {
          const date = new Date(year, monthIndex, day);
          if (!isNaN(date.getTime())) {
            return formatDate(date);
          }
        }
      }
    }
    
    // If no format matches, return the original string
    return trimmedDateStr;
    
  } catch (error) {
    return dateStr.toString();
  }
}

/**
 * Parse date string according to specific format
 */
function parseDate(dateStr: string, format: string): Date | null {
  try {
    if (format === "YYYY-MM-DD HH:mm:ss") {
      const parts = dateStr.split(" ");
      const datePart = parts[0];
      const [year, month, day] = datePart.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    
    if (format === "YYYY-MM-DD") {
      const [year, month, day] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    
    if (format === "MM/DD/YYYY") {
      const [month, day, year] = dateStr.split("/").map(Number);
      return new Date(year, month - 1, day);
    }
    
    if (format === "MM/DD/YY") {
      const [month, day, year] = dateStr.split("/").map(Number);
      const fullYear = year < 50 ? 2000 + year : 1900 + year; // Assume 00-49 is 2000-2049, 50-99 is 1950-1999
      return new Date(fullYear, month - 1, day);
    }
    
    if (format === "DD/MM/YYYY") {
      const [day, month, year] = dateStr.split("/").map(Number);
      return new Date(year, month - 1, day);
    }
    
    if (format === "MM-DD-YYYY") {
      const [month, day, year] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    
    if (format === "DD-MM-YYYY") {
      const [day, month, year] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Format date to MM/DD/YYYY
 */
function formatDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Get month index from month name
 */
function getMonthIndex(monthName: string): number {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const shortMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  
  const fullIndex = months.findIndex(month => 
    month.toLowerCase() === monthName.toLowerCase()
  );
  
  if (fullIndex !== -1) {
    return fullIndex;
  }
  
  const shortIndex = shortMonths.findIndex(month => 
    month.toLowerCase() === monthName.toLowerCase()
  );
  
  return shortIndex;
}

/**
 * Compare two standardized dates for equality
 */
export function datesEqual(date1: string, date2: string): boolean {
  if (!date1 || !date2) {
    return !date1 && !date2; // Both empty is considered equal
  }
  
  return date1 === date2;
}

/**
 * Check if a date string is valid
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr || dateStr === "NULL" || dateStr === "") {
    return false;
  }
  
  const standardized = standardizeDate(dateStr);
  return standardized !== "" && standardized !== dateStr;
}

/**
 * Get current date in MM/DD/YYYY format
 */
export function getCurrentDate(): string {
  return formatDate(new Date());
}