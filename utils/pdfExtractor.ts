import * as pdfjsLib from 'pdfjs-dist';

/**
 * Extracts text content from a PDF file
 * @param file - The PDF file to extract text from
 * @returns Promise<string> - The extracted text content
 * @throws Error if PDF extraction fails
 */
export const extractTextFromPdf = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      if (!event.target?.result) {
        return reject(new Error("Failed to read file. The file may be corrupted."));
      }
      
      try {
        const pdf = await pdfjsLib.getDocument({
          data: event.target.result as ArrayBuffer,
          useSystemFonts: true
        }).promise;
        
        if (pdf.numPages === 0) {
          return reject(new Error("The PDF file appears to be empty or corrupted."));
        }
        
        let text = '';
        const maxPages = Math.min(pdf.numPages, 50); // Limit to 50 pages for performance
        
        for (let i = 1; i <= maxPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items
              .map((item: any) => 'str' in item ? item.str : '')
              .join(' ')
              .trim();
            
            if (pageText) {
              text += (text ? ' ' : '') + pageText;
            }
          } catch (pageError) {
            console.warn(`Error extracting text from page ${i}:`, pageError);
            // Continue with other pages
          }
        }
        
        if (!text.trim()) {
          return reject(new Error("Could not extract text from the PDF. The file might be image-based or password-protected."));
        }
        
        resolve(text.trim());
      } catch (error: any) {
        console.error("PDF extraction error:", error);
        
        if (error.message?.includes("password")) {
          reject(new Error("This PDF is password-protected. Please remove the password and try again."));
        } else if (error.message?.includes("Invalid PDF")) {
          reject(new Error("Invalid PDF file. Please ensure the file is a valid PDF document."));
        } else {
          reject(new Error(`Failed to parse PDF file: ${error.message || "Unknown error"}`));
        }
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error reading file. Please ensure the file is not corrupted."));
    };
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("File size exceeds 10MB limit. Please upload a smaller file."));
      return;
    }
    
    reader.readAsArrayBuffer(file);
  });
};

