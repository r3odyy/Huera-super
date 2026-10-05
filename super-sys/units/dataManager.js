const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ panels: {}, ticketCounter: 0 }, null, 2));
  }
  try {
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(rawData);
  } catch (e) {
    return { panels: {}, ticketCounter: 0 };
  }
}

function saveData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function getPanels() {
  const data = loadData();
  return data.panels || {};
}

function savePanel(panelId, panelData) {
  const data = loadData();
  if (!data.panels) data.panels = {};
  data.panels[panelId] = { ...data.panels[panelId], ...panelData };
  saveData(data);
}

function getNextTicketNumber() {
  const data = loadData();
  data.ticketCounter = (data.ticketCounter || 0) + 1;
  saveData(data);
  return data.ticketCounter;
}

function getTicketCount() {
  const data = loadData();
  return data.ticketCounter || 0;
}

module.exports = {
  getPanels,
  savePanel,
  getNextTicketNumber,
  getTicketCount
};