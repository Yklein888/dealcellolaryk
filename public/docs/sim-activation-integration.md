# הוראות אינטגרציה - הפעלת סימים דו-כיוונית

## סקירה כללית

מערכת זו מאפשרת להפעיל סימים מתוך Lovable, עם ביצוע אוטומטי באתר CellStation באמצעות Bookmarklet.

```
Lovable UI → Google Apps Script → Bookmarklet → CellStation
     ↑              ↓                  ↓
     └──── Callback ←──────────────────┘
```

---

## חלק 1: עדכון Google Apps Script

הוסף את הקוד הבא ל-Google Apps Script הקיים שלך:

```javascript
// Endpoint לקבלת בקשות הפעלה מ-Lovable
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'activate') {
      return handleActivationRequest(data);
    }
    
    if (data.action === 'get_pending') {
      return handleGetPending();
    }
    
    if (data.action === 'mark_done') {
      return handleMarkDone(data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleActivationRequest(data) {
  const sheet = getOrCreateActivationSheet();
  
  sheet.appendRow([
    data.sim_number,
    'pending',
    data.requested_at || new Date().toISOString(),
    '', // completed_at
    data.rental_id || '',
    data.customer_id || ''
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleGetPending() {
  const sheet = getOrCreateActivationSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const pending = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === 'pending') {
      pending.push({
        sim_number: data[i][0],
        status: data[i][1],
        requested_at: data[i][2],
        rental_id: data[i][4],
        customer_id: data[i][5],
        row_index: i + 1
      });
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ pending }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleMarkDone(data) {
  const sheet = getOrCreateActivationSheet();
  const allData = sheet.getDataRange().getValues();
  
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === data.sim_number && allData[i][1] === 'pending') {
      sheet.getRange(i + 1, 2).setValue(data.success ? 'done' : 'failed');
      sheet.getRange(i + 1, 4).setValue(new Date().toISOString());
      
      // Send callback to Lovable
      sendCallbackToLovable(data.sim_number, data.success, data.error_message);
      break;
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateActivationSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Activation Queue');
  
  if (!sheet) {
    sheet = ss.insertSheet('Activation Queue');
    sheet.appendRow(['sim_number', 'status', 'requested_at', 'completed_at', 'rental_id', 'customer_id']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  
  return sheet;
}

function sendCallbackToLovable(simNumber, success, errorMessage) {
  const LOVABLE_CALLBACK_URL = 'https://qifcynwnxmtoxzpskmmt.supabase.co/functions/v1/sim-activation-callback';
  const API_KEY = 'sim-activation-secret-key'; // עדכן לפי הצורך
  
  try {
    UrlFetchApp.fetch(LOVABLE_CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      payload: JSON.stringify({
        sim_number: simNumber,
        success: success,
        error_message: errorMessage || null
      })
    });
  } catch (e) {
    console.error('Failed to send callback:', e);
  }
}
```

---

## חלק 2: קוד Bookmarklet

צור Bookmarklet חדש בדפדפן עם הקוד הבא:

```javascript
javascript:(function(){
  const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
  
  async function activateSIMs() {
    // Get pending SIMs
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'get_pending' })
    });
    const data = await response.json();
    
    if (!data.pending || data.pending.length === 0) {
      alert('אין סימים ממתינים להפעלה');
      return;
    }
    
    alert(`נמצאו ${data.pending.length} סימים להפעלה. לוחץ OK להתחלה.`);
    
    for (const sim of data.pending) {
      try {
        // Find the SIM row in the page table
        const simRow = findSimRow(sim.sim_number);
        
        if (!simRow) {
          await markDone(sim.sim_number, false, 'SIM not found in table');
          continue;
        }
        
        // Click the activate button
        const activateBtn = simRow.querySelector('button.activate, .activate-btn');
        if (activateBtn) {
          activateBtn.click();
          await sleep(2000); // Wait for activation
          
          // Check if successful
          const success = checkActivationSuccess(simRow);
          await markDone(sim.sim_number, success, success ? null : 'Activation button click failed');
        } else {
          await markDone(sim.sim_number, false, 'Activate button not found');
        }
        
      } catch (e) {
        await markDone(sim.sim_number, false, e.message);
      }
    }
    
    alert('סיום! בדוק את הסטטוסים ב-Lovable.');
  }
  
  function findSimRow(simNumber) {
    const rows = document.querySelectorAll('table tr');
    for (const row of rows) {
      if (row.textContent.includes(simNumber)) {
        return row;
      }
    }
    return null;
  }
  
  function checkActivationSuccess(row) {
    // Customize based on CellStation's UI
    return row.textContent.includes('פעיל') || row.textContent.includes('Active');
  }
  
  async function markDone(simNumber, success, errorMessage) {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'mark_done',
        sim_number: simNumber,
        success: success,
        error_message: errorMessage
      })
    });
  }
  
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  activateSIMs();
})();
```

### הוראות התקנה:
1. צור Bookmark חדש בדפדפן
2. בשדה URL, הדבק את כל הקוד למעלה
3. שנה את `YOUR_SCRIPT_ID` ל-ID של ה-Google Apps Script שלך
4. היכנס לאתר CellStation
5. לחץ על ה-Bookmark להפעלת הסימים

---

## חלק 3: הגדרת Secret (אופציונלי)

להגנה נוספת, הוסף secret ב-Lovable:
- **שם**: `SIM_ACTIVATION_API_KEY`
- **ערך**: מחרוזת סודית לבחירתך

עדכן את אותו ערך גם ב-Google Apps Script בפונקציה `sendCallbackToLovable`.

---

## שימוש

1. בדף ההשכרות ב-Lovable, לחץ על "הפעל סים"
2. הסטטוס ישתנה ל-"ממתין להפעלה" (🔄)
3. היכנס לאתר CellStation והפעל את ה-Bookmarklet
4. ה-Bookmarklet יבצע את ההפעלה וישלח עדכון
5. הסטטוס ב-Lovable יתעדכן ל-✅ או ❌
