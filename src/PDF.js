// import * as pdfjslib from 'pdfjs-dist/es5/build/pdf.js';

// export default class Pdf {

//     static async getPDFText(source){
//         const pdf = await pdfjslib.getDocument(source).promise;
//         const maxPages = pdf.numPages;
//         const pageTextPromises = [];
//         for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
//           pageTextPromises.push(Pdf.getPageText(pdf, pageNo));
//         }
//         const pageTexts = await Promise.all(pageTextPromises);
//         return pageTexts.join(' ');
//       }
//     }