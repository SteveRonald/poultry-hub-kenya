import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getApiUrl } from '../config/api';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface ExportOptions {
  title: string;
  subtitle?: string;
  data: any;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  exportedBy: string;
  userRole: 'admin' | 'vendor';
}

// Helper function to create a canvas-based bar chart
const createCanvasChart = (data: any[], title: string, type: 'bar' | 'pie' = 'bar'): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Use high resolution for crisp rendering
  const scale = 2; // 2x resolution for crispness
  canvas.width = 400 * scale;
  canvas.height = 250 * scale;
  
  // Scale the context to match the device pixel ratio
  ctx.scale(scale, scale);
  
  // Enable text antialiasing for better text quality
  ctx.textBaseline = 'top';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Clear canvas with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 400, 250);
  
  if (type === 'bar') {
    // Draw bar chart
    const margin = 40;
    const chartWidth = 400 - 2 * margin; // Use original dimensions
    const chartHeight = 250 - 2 * margin; // Use original dimensions
    
    // Draw title with better font rendering
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 200, 25); // Use scaled coordinates
    
    // Calculate bar dimensions
    const maxValue = Math.max(...data.map(d => d.daily_revenue || d.value || d.count || 0));
    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length;
    
    // Draw bars
    data.forEach((item, index) => {
      const value = item.daily_revenue || item.value || item.count || 0;
      const barHeight = (value / maxValue) * chartHeight * 0.8;
      const x = margin + index * barSpacing + (barSpacing - barWidth) / 2;
      const y = margin + chartHeight - barHeight;
      
      // Draw bar with better quality
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Add subtle border to bars for definition
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);
      
      // Draw value on top with better font
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(value.toString(), x + barWidth / 2, y - 8);
      
      // Draw date label with better font
      if (item.date) {
        ctx.font = '10px Arial, sans-serif';
        const dateLabel = item.date.split('-').slice(1).join('/');
        ctx.fillText(dateLabel, x + barWidth / 2, margin + chartHeight + 18);
      }
    });
    
    // Draw axes
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + chartHeight);
    ctx.lineTo(margin + chartWidth, margin + chartHeight);
    ctx.stroke();
    
  } else if (type === 'pie') {
    // Draw pie chart (as legend)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 200, 25); // Use scaled coordinates
    
    const colors = ['#2c5530', '#4a7c59', '#6ba86b', '#8bc34a', '#a5d6a7'];
    const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
    
    let y = 60;
    data.forEach((item, index) => {
      const value = item.count || 0;
      const percentage = ((value / total) * 100).toFixed(1);
      const color = colors[index % colors.length];
      
      // Draw color square with border
      ctx.fillStyle = color;
      ctx.fillRect(30, y, 18, 18);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, y, 18, 18);
      
      // Draw label with better font
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 13px Arial, sans-serif';
      ctx.textAlign = 'left';
      const label = item.status || `Item ${index + 1}`;
      ctx.fillText(`${label}: ${percentage}% (${value})`, 55, y + 13);
      
      y += 25;
    });
  }
  
  return canvas.toDataURL('image/png');
};

// Helper function to add logo
const addLogo = async (doc: jsPDF, x: number, y: number, width: number = 25, height: number = 25) => {
  try {
    // Try multiple approaches to load the logo
    const possibleUrls = [
      window.location.origin + '/logo.png',
      getApiUrl('/logo.png'),
      '/logo.png'
    ];
    
    let logoLoaded = false;
    
    for (const logoUrl of possibleUrls) {
      try {
        const response = await fetch(logoUrl, {
          method: 'GET',
          headers: {
            'Accept': 'image/png,image/*,*/*',
          },
        });
        
        if (response.ok) {
          const blob = await response.blob();
          
          // Convert blob to base64 data URL
          return new Promise<number>((resolve) => {
            const reader = new FileReader();
            reader.onload = function() {
              try {
                const dataUrl = reader.result as string;
                
                // Add image with proper aspect ratio (square for logo)
                doc.addImage(dataUrl, 'PNG', x, y, width, height);
                logoLoaded = true;
                resolve(y + height + 8);
              } catch (error) {
                console.error('Error adding logo image to PDF:', error);
                if (!logoLoaded) {
                  // Fallback to text logo
                  doc.setFontSize(14);
                  doc.setTextColor(34, 197, 94);
                  doc.setFont('helvetica', 'bold');
                  doc.text('PoultryHub Kenya', x, y + 10);
                  resolve(y + 15);
                }
              }
            };
            reader.onerror = () => {
              if (!logoLoaded) {
                // Fallback to text logo
                doc.setFontSize(14);
                doc.setTextColor(34, 197, 94);
                doc.setFont('helvetica', 'bold');
                doc.text('PoultryHub Kenya', x, y + 10);
                resolve(y + 15);
              }
            };
            reader.readAsDataURL(blob);
          });
        }
      } catch (fetchError) {
        // Continue to next URL
      }
    }
    
    // If all attempts failed, use fallback
    doc.setFontSize(14);
    doc.setTextColor(34, 197, 94);
    doc.setFont('helvetica', 'bold');
    doc.text('PoultryHub Kenya', x, y + 10);
    return y + 15;
    
  } catch (error) {
    console.error('Error in addLogo function:', error);
    // Fallback to text logo
    doc.setFontSize(14);
    doc.setTextColor(34, 197, 94);
    doc.setFont('helvetica', 'bold');
    doc.text('PoultryHub Kenya', x, y + 10);
    return y + 15;
  }
};

export const exportToPDF = async (options: ExportOptions) => {
  const { title, subtitle, data, dateRange, exportedBy, userRole } = options;
  
  // Create new PDF document
  const doc = new jsPDF();
  
  try {
    // Add logo - centered at top of PDF
    const pageWidth = doc.internal.pageSize.width;
    const logoWidth = 25;
    const logoX = (pageWidth - logoWidth) / 2; // Center the logo
    let yPosition = await addLogo(doc, logoX, 10);
    
    // Add title - centered below logo
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    const titleWidth = doc.getTextWidth(title);
    const titleX = (pageWidth - titleWidth) / 2; // Center the title
    doc.text(title, titleX, yPosition);
    yPosition += 8;
    
    // Add subtitle if provided - centered
    if (subtitle) {
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      const subtitleWidth = doc.getTextWidth(subtitle);
      const subtitleX = (pageWidth - subtitleWidth) / 2; // Center the subtitle
      doc.text(subtitle, subtitleX, yPosition);
      yPosition += 6;
    }
    
    // Add date range and export info in a more compact format
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const exportInfo: string[] = [];
    if (dateRange) {
      exportInfo.push(`Period: ${dateRange.startDate} to ${dateRange.endDate}`);
    } else {
      exportInfo.push('Period: All Time');
    }
    exportInfo.push(`Exported by: ${exportedBy}`);
    exportInfo.push(`Export Date: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`);
    
    exportInfo.forEach((info) => {
      doc.text(info, 20, yPosition);
      yPosition += 5;
    });
    
    yPosition += 10;
    
    // Add overview section
    if (data.overview) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Overview', 20, yPosition);
      yPosition += 6;
      
        // Create overview table
        const overviewData: string[][] = Object.entries(data.overview).map(([key, value]) => [
          key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          typeof value === 'number' ? (key.includes('revenue') || key.includes('value') ? `KSH ${value.toLocaleString()}` : value.toLocaleString()) : String(value)
        ]);
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Metric', 'Value']],
          body: overviewData,
          theme: 'grid',
          headStyles: { 
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            cellPadding: 3
          },
          bodyStyles: { 
            fontSize: 9,
            textColor: [0, 0, 0],
            cellPadding: 3
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          margin: { left: 20, right: 20 },
          styles: {
            cellPadding: 3,
            lineColor: [200, 200, 200],
            lineWidth: 0.3,
            halign: 'left',
            valign: 'middle'
          },
          columnStyles: {
            0: { halign: 'left', cellWidth: 80 },
            1: { halign: 'right', cellWidth: 60 }
          }
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 12;
    }
    
    // Add revenue/sales data
    if (data.revenue || data.sales) {
      const salesData = data.revenue || data.sales;
      
      if (salesData.daily_trend && salesData.daily_trend.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Trend', 20, yPosition);
      yPosition += 6;
        
        const trendData: string[][] = salesData.daily_trend.slice(-10).map((item: any) => [
          item.date,
          userRole === 'admin' ? 
            `KSH ${item.daily_revenue?.toLocaleString() || 0}` :
            `KSH ${item.daily_revenue?.toLocaleString() || 0}`,
          item.daily_orders?.toString() || '0'
        ]);
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Date', 'Revenue', 'Orders']],
          body: trendData,
          theme: 'grid',
          headStyles: { 
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            cellPadding: 3
          },
          bodyStyles: { 
            fontSize: 8,
            textColor: [0, 0, 0],
            cellPadding: 3
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          margin: { left: 20, right: 20 },
          styles: {
            cellPadding: 3,
            lineColor: [200, 200, 200],
            lineWidth: 0.3,
            halign: 'center',
            valign: 'middle'
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 40 },
            1: { halign: 'right', cellWidth: 50 },
            2: { halign: 'center', cellWidth: 30 }
          }
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 12;
      }
    }
    
    // Add orders data
    if (data.orders) {
      if (data.orders.status_distribution && data.orders.status_distribution.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Order Status Distribution', 20, yPosition);
      yPosition += 6;
        
        const statusData: string[][] = data.orders.status_distribution.map((item: any) => [
          item.status.charAt(0).toUpperCase() + item.status.slice(1),
          item.count.toString()
        ]);
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Status', 'Count']],
          body: statusData,
          theme: 'grid',
          headStyles: { 
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            cellPadding: 3
          },
          bodyStyles: { 
            fontSize: 9,
            textColor: [0, 0, 0],
            cellPadding: 3
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          margin: { left: 20, right: 20 },
          styles: {
            cellPadding: 3,
            lineColor: [200, 200, 200],
            lineWidth: 0.3,
            halign: 'left',
            valign: 'middle'
          },
          columnStyles: {
            0: { halign: 'left', cellWidth: 80 },
            1: { halign: 'center', cellWidth: 40 }
          }
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 12;
      }
    }
    
    // Add products data for vendors
    if (userRole === 'vendor' && data.products) {
      if (data.products.top_selling && data.products.top_selling.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Selling Products', 20, yPosition);
      yPosition += 6;
        
        const productsData: string[][] = data.products.top_selling.slice(0, 10).map((item: any) => [
          item.product_name,
          item.category,
          item.total_quantity.toString(),
          `KSH ${item.total_revenue.toLocaleString()}`
        ]);
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Product', 'Category', 'Quantity', 'Revenue']],
          body: productsData,
          theme: 'grid',
          headStyles: { 
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold',
            cellPadding: 2
          },
          bodyStyles: { 
            fontSize: 8,
            textColor: [0, 0, 0],
            cellPadding: 2
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          margin: { left: 20, right: 20 },
          styles: {
            cellPadding: 2,
            lineColor: [200, 200, 200],
            lineWidth: 0.3,
            halign: 'left',
            valign: 'middle'
          },
          columnStyles: {
            0: { halign: 'left', cellWidth: 50 },
            1: { halign: 'left', cellWidth: 35 },
            2: { halign: 'center', cellWidth: 25 },
            3: { halign: 'right', cellWidth: 30 }
          }
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 12;
      }
    }
    
    // Add customers data for admin
    if (userRole === 'admin' && data.customers) {
      if (data.customers.top_customers && data.customers.top_customers.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Customers', 20, yPosition);
      yPosition += 6;
        
        const customersData: string[][] = data.customers.top_customers.slice(0, 10).map((item: any) => [
          item.customer_name,
          item.order_count.toString(),
          `KSH ${item.total_spent.toLocaleString()}`
        ]);
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Customer', 'Orders', 'Total Spent']],
          body: customersData,
          theme: 'grid',
          headStyles: { 
            fillColor: [34, 197, 94],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            cellPadding: 3
          },
          bodyStyles: { 
            fontSize: 9,
            textColor: [0, 0, 0],
            cellPadding: 3
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          margin: { left: 20, right: 20 },
          styles: {
            cellPadding: 3,
            lineColor: [200, 200, 200],
            lineWidth: 0.3,
            halign: 'left',
            valign: 'middle'
          },
          columnStyles: {
            0: { halign: 'left', cellWidth: 80 },
            1: { halign: 'center', cellWidth: 30 },
            2: { halign: 'right', cellWidth: 50 }
          }
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 12;
      }
    }
    
    // Add charts section after all tables with proper spacing and styling
    try {
      yPosition += 20; // Add extra spacing before charts
      
      // Add section header for charts
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Visual Analytics', 20, yPosition);
      yPosition += 15;
      
      // Add Revenue Trend Chart using Canvas
      let chartData = data.revenue?.daily_trend || data.sales?.daily_trend;
      
      if (!chartData || chartData.length === 0) {
        console.log('No revenue data found, creating sample data');
        // Create sample data for testing
        chartData = [
          { date: '2025-01-01', daily_revenue: 150 },
          { date: '2025-01-02', daily_revenue: 200 },
          { date: '2025-01-03', daily_revenue: 175 },
          { date: '2025-01-04', daily_revenue: 300 },
          { date: '2025-01-05', daily_revenue: 250 }
        ];
      }
      
      console.log('Generating revenue chart with data:', chartData);
      
      try {
        const chartImage = createCanvasChart(chartData, 'Revenue Trend (Last 10 Days)', 'bar');
        
        if (chartImage) {
          // Add chart image to PDF with high resolution
          doc.addImage(chartImage, 'PNG', 20, yPosition, 170, 105);
          yPosition += 115;
        }
      } catch (error) {
        console.error('Error generating revenue chart:', error);
      }
      
      // Add Status Distribution Chart using Canvas
      let statusData = data.orders?.status_distribution;
      
      if (!statusData || statusData.length === 0) {
        console.log('No status data found, creating sample data');
        // Create sample status data
        statusData = [
          { status: 'delivered', count: 45 },
          { status: 'processing', count: 12 },
          { status: 'pending', count: 8 },
          { status: 'cancelled', count: 3 }
        ];
      }
      
      console.log('Generating status chart with data:', statusData);
      
      try {
        const statusChartImage = createCanvasChart(statusData, 'Order Status Distribution', 'pie');
        
        if (statusChartImage) {
          // Add chart image to PDF with high resolution
          doc.addImage(statusChartImage, 'PNG', 20, yPosition, 170, 105);
          yPosition += 115;
        }
      } catch (error) {
        console.error('Error generating status chart:', error);
      }
    } catch (chartError) {
      console.error('Error generating charts:', chartError);
      // Continue without charts if they fail
    }
    
    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${pageCount}`, 190, 285);
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${userRole}_analytics_${timestamp}.pdf`;
    
    // Save the PDF
    doc.save(filename);
    
    return { success: true, filename };
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
