const electron = require('electron');
const packagejson = require('./package.json');


// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;
// Module to send/receive message with all renderers
const {ipcMain} = require('electron');


// parsing arguments using node.js process
var debug = false;
for (let arg of process.argv) {
   if("--debug" == arg) {
      debug = true;
      break;
   }
}


// Keep a global reference of the window object to avaoid JS garbage collected to close them automatically
let appWindows = {
	tree      : null,
	item      : null,
	partTable : null,
   stats     : null,
   popup     : null,
   about     : null,
};


// -----------------------------------------------------------------------------
// TREE
// -----------------------------------------------------------------------------

// When Electron has finished initialization
app.on('ready', () => {
	// Create the browser window.
	appWindows.tree = new BrowserWindow({
      width    : 1200,
      height   : 800,
      minWidth : 800
   });

	// and load the index.html of the app.
	appWindows.tree.loadURL(`file://${__dirname}/html/tree.html`);

   // Open the dev tools...
	if ((undefined !== debug) && debug) appWindows.tree.webContents.openDevTools();

   // Emitted just before closing the window
   appWindows.tree.on('close', function(e){
      // do not close the window
      e.preventDefault();
      // prevent the tree renderer that the user want to quit
      appWindows.tree.webContents.send('close');
   });

   // The tree is OK to exit
	ipcMain.once('quit', function() {
      process.exit();
	});

   // configuration of the Application menu
	const {Menu} = require('electron');
	const template = [
		{
			label: 'Edit',
			submenu: [
				{
					role: 'undo'
				},
				{
					role: 'redo'
				},
				{
					type: 'separator'
				},
				{
					role: 'cut'
				},
				{
					role: 'copy'
				},
				{
					role: 'paste'
				},
				{
					role: 'delete'
				},
				{
					role: 'selectall'
				}
			]
		},
		{
			role: 'window',
			submenu: [
				{
					role: 'minimize'
				},
				{
					role: 'close'
				}
			]
		},
		{
			role: 'help',
			submenu: [
				{
					label: `About ${packagejson.name}`,
					click () {
                  // Create the item window if it doesn't exist
                  if(null === appWindows.about) {
                  	appWindows.about = new BrowserWindow({
                  		width           : 450,
                  		height          : 420,
                        alwaysOnTop     : true,
                  		resizable       : false,
                        autoHideMenuBar : true,
                        useContentSize  : true,
                        thickFrame      : true,
                        titleBarStyle   : 'hiddenInset'
                     });

                  	// Open the dev tools...
                  	if ((undefined !== debug) && debug) appWindows.about.webContents.openDevTools();

                  	// Load the *.html of the window.
                  	appWindows.about.loadURL(`file://${__dirname}/html/about.html`);

                  	// Emitted when the window is closed.
                  	appWindows.about.on('closed', function () {
                  		// Dereference the window object
                  		appWindows.about = null;
                  	});
                  }
               }
				},
            {
               label: 'Bug report and enhancement request',
               click () {
                  require('electron').shell.openExternal('https://github.com/smariel/PTree/issues');
               }
            },
            {
					label: 'Equation Summary',
					click () {
                  require('electron').shell.openItem(`${__dirname}/docs/equations.pdf`);
               }
				},
			]
		},
      ((undefined !== debug) && debug) ? {
		label: 'Debug',
			submenu: [
				{
					label: 'Reload',
					accelerator: 'CmdOrCtrl+R',
					click (item, focusedWindow) {
						if (focusedWindow) focusedWindow.reload();
					}
				},
				{
					label: 'Toggle Developer Tools',
					accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
					click (item, focusedWindow) {
						if (focusedWindow) focusedWindow.webContents.toggleDevTools();
					}
				}
			]
		} : {},
	];

   // menu add-ons for macOS
	if (process.platform === 'darwin') {
		template.unshift({
			label: app.getName(),
			submenu: [
				{
					role: 'hide'
				},
				{
					role: 'quit'
				}
			]
		});
	}

   // set the menu
	menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
});


// Quit the app when all windows are closed.
app.on('window-all-closed', function () {
	app.quit();
});



// -----------------------------------------------------------------------------
// ITEM EDITION
// -----------------------------------------------------------------------------

// bind an event handler on a request to edit an item
// this request is sent synchronusly by an item object on the tree view
// so the tree view script is blocked untill it received a response
ipcMain.on('edit-request', function (itemEvent, itemdata) {
	// parse the data to resize the window
	var item = JSON.parse(itemdata);

	// Create the item window
	appWindows.item = new BrowserWindow({
		width           : ('source' == item.type) ? 840 : 600,
		height          : ('source' == item.type) ? 485 : 485,
		parent          : appWindows.tree,
		modal           : true,
		resizable       : false,
      autoHideMenuBar : true,
      useContentSize  : true
	});

	// Open the dev tools...
	if ((undefined !== debug) && debug) appWindows.item.webContents.openDevTools();

	// Load the *.html of the window.
	appWindows.item.loadURL(`file://${__dirname}/html/item.html`);

   // send data to the item window after loading
   appWindows.item.webContents.on('did-finish-load', function() {
      appWindows.item.webContents.send('edit-window-open', itemdata);
   });

	// wait for the edit window to send data when it closes
	ipcMain.once('edit-window-close', function(event_wclose, newitemdata) {
		// save those datas before sending them when the close event is trigged
		itemdata = newitemdata;
	});

	// Emitted when the window is closed.
	appWindows.item.on('closed', function () {
		// sent the (new or old) data to the tree window
		itemEvent.returnValue = itemdata;
		// Dereference the window object
		appWindows.item = null;
	});
});



// -----------------------------------------------------------------------------
// PART TABLE
// -----------------------------------------------------------------------------

// bind an event handler on a request to open the part list
// this request is sent synchronusly by the tree window
// so the tree script is blocked untill it received a response
ipcMain.on('partTable-request', function (partEvent, treeData, partlistData) {

	// Create the partTable window
	appWindows.partTable = new BrowserWindow({
		width           : 1024,
		height          : 768,
		parent          : appWindows.tree,
		modal           : process.platform !== 'darwin',
		resizable       : true,
      useContentSize  : true
	});

	// Open the dev tools...
	if ((undefined !== debug) && debug) appWindows.partTable.webContents.openDevTools();

	// Load the *.html of the window.
	appWindows.partTable.loadURL(`file://${__dirname}/html/partTable.html`);

   // send data to the partTable window after loading
   appWindows.partTable.webContents.on('did-finish-load', function() {
      appWindows.partTable.webContents.send('partTable-window-open', treeData, partlistData);
   });

	// wait for the edit window to send data when it closes
	ipcMain.once('partTable-window-close', function(event_wclose, newPartlistData) {
		// save the new data before sending them when the close event is trigged
		partlistData = newPartlistData;
	});

	// Emitted when the window is closed.
	appWindows.partTable.on('closed', function () {
		// sent the (new or old) data to the tree window
		partEvent.returnValue = partlistData;
		// Dereference the window object
		appWindows.partTable = null;
	});
});



// -----------------------------------------------------------------------------
// STATS
// -----------------------------------------------------------------------------

// bind an event handler on a request to open the stats window
// this request is sent asynchronusly by the tree window
ipcMain.on('stats-request', function (statsEvent, data) {
   // if the windows is already open
   if(appWindows.stats !== null) {
      appWindows.stats.focus();
      return;
   }

	// Create the  window
	appWindows.stats = new BrowserWindow({
		width           : 800,
		height          : 400,
		resizable       : true,
      useContentSize  : true,
      alwaysOnTop     : true
	});

	// Open the dev tools...
	if ((undefined !== debug) && debug) appWindows.stats.webContents.openDevTools();

	// Load the *.html of the window.
	appWindows.stats.loadURL(`file://${__dirname}/html/stats.html`);

   // send data to the stats window after loading
   appWindows.stats.webContents.on('did-finish-load', function() {
      appWindows.stats.webContents.send('stats-window-open', data);
   });

	// Emitted when the window is closed.
	appWindows.stats.on('closed', function () {
		// Dereference the window object
		appWindows.stats = null;
	});
});

// inform the stats window (if open) that an item has been selected on the tree
ipcMain.on('stats-selectItem', function (event, data) {
   if(null !== appWindows.stats) {
      appWindows.stats.webContents.send('stats-selectItem',data);
   }
});

// inform the PTree window that an item has been selected on the stats
ipcMain.on('tree-selectItem', function (event, data) {
   appWindows.tree.webContents.send('tree-selectItem',data);
});



// -----------------------------------------------------------------------------
// POPUP
// -----------------------------------------------------------------------------

// bind an event handler on a request to open a generic popup with OK/Cancel commands
// this request is sent synchronusly by any window with a data object describing the popup
// when the popup opens, it ask main.js for the data
// when the popup is validates/closed, it send back the value of OK/CANCEL
// then main.js send back the OK/CANCEL value to the initiatior of the popup
// popupData has the following properties : title, width, height, sender, content, btn_ok, btn_cancel
ipcMain.on('popup-request', function (popupEvent, popupData) {
   // Create the window
   appWindows.popup = new BrowserWindow({
      title           : (undefined === popupData.title ) ? ''   : popupData.title,
      width           : (undefined === popupData.width ) ? 500  : popupData.width,
      height          : (undefined === popupData.height) ? 180  : popupData.height,
      parent          : (undefined === popupData.sender) ? null : appWindows[popupData.sender],
      modal           : true,
      autoHideMenuBar : true,
      resizable       : false,
      minimizable     : false,
      maximizable     : false,
      useContentSize  : true
   });

   // set as CANCEL by default
   var isOK = false;

	// Load the *.html of the window.
	appWindows.popup.loadURL(`file://${__dirname}/html/popup.html`);

   // wait for the popup to request the data then send them
	ipcMain.once('popup-open', function(event_wopen, response){
		event_wopen.returnValue = popupData;
	});

   // wait for the popup to send data when it closes
	ipcMain.once('popup-close', function(event_wclose, response) {
      isOK = response;
	});

   // Emitted when the window is closed.
	appWindows.popup.on('closed', function () {
		// send the command to the tree renderer which is waiting to close
		popupEvent.returnValue = isOK;
		// Dereference the window object
      appWindows.popup = null;
	});
});
