// -----------------------------------------------------------------------------
// Load Class
//    A Load is a specific Item
//    It inherit from the Item class
//
//    Check the summary of the formulas : ../docs/equations.pdf
// -----------------------------------------------------------------------------

const Item = require('./class.Item.js');

class Load extends Item {

  constructor(id, parent, tree) {
    // call the constructor of the parent class
    super(id, parent, 'load', tree);

    // set the specific characs of a loaded.bs.modal
    this.characs = {
      name       : 'Load name',
      custom1    : '',
      //custom2    : '', <v1.7.0
      ityp       : 0,
      imax       : 0,
      color      : '#00bfa5',
      loadtype   : 0,
      /*
        load types (v1.4.0) :
        0: partlist
        1: raw
        2: sync (associated with celltyp and cellmax)
        3: raw power (v2.1.0)
      */
      celltyp    : 'A1',
      cellmax    : 'B1',
      hidden     : false,
      shape      : 1,  // v1.7.0
      badge_in   : '', // v1.7.0
      ptyp       : 0,  // v2.1.0
      pmax       : 0,  // v2.1.0
    };
  }


  // check if the item is a load
  isLoad() {
    return true;
  }


  // Check if the item is a load with the current in the partlist
  isInPartlist() {
    return ('0' == this.characs.loadtype);
  }


  // Check if the item is a load with the current defined as raw data
  isRaw() {
    return ('1' == this.characs.loadtype);
  }


  // Check if the item is a load with the current synced
  isSynced() {
    return ('2' == this.characs.loadtype);
  }


  // Check if the item is a load with the power defined as raw data
  isRawPower() {
    return ('3' == this.characs.loadtype);
  }


  // getInputVoltage() from the parent class


  // get the output voltage of an item
  getOutputVoltage() {
    throw 'Loads have no output voltage';
  }


  // get the input current of an item
  getInputCurrent(valType) {
    let i_in = 0;

    // if the load is a raw power value, i_in = p / v_in
    if(this.isRawPower()) {
      i_in = this.getInputPower(valType) / this.getInputVoltage(valType);
    }
    // for all other loads, return the user value
    else {
      i_in = parseFloat(this.characs['i' + valType]);
    }

    return i_in;
  }


  // get the output current of an item
  getOutputCurrent() {
    throw 'Loads have no output current';
  }


  // get the input power of an item
  getInputPower(valType) {
    let p_in = 0;

    // if the load is a raw power value, return the user value
    if(this.isRawPower()) {
      p_in = parseFloat(this.characs['p' + valType]);
    }
    // for all other loads, p_in = v_in * i_in
    else {
      p_in = this.getInputVoltage(valType) * this.getInputCurrent(valType);
    }

    return p_in;
  }


  // get the output power of an item
  getOutputPower() {
    throw 'Loads have no output power';
  }


  // get the power loss in an item
  getPowerLoss() {
    throw 'Loads have no power loss';
  }


  // get the reg or load type
  getType() {
    if     (this.isRaw())        return 'Raw current';
    else if(this.isInPartlist()) return 'PTree partlist';
    else if(this.isSynced())     return 'External spreadsheet';
    else if(this.isRawPower())   return 'Raw power';
    else                         return 'Other';
  }


  // Open a new window to edit the item
  // see the main method in class.Item.js
  // Need a partlist to update the consumptions in some cases
  async edit(partList, sheet) {
    // edit the item with the parent method
    await super.edit();

    // return a promise
    return new Promise(resolve => {

      // if the load is not in the part list
      // remove all consumptions on the parts
      if(!this.isInPartlist()) {
        partList.forEachPart((part) => {
          if(part.isConsuming(this)) {
            part.setConsumption(0, this, 'typ');
            part.setConsumption(0, this, 'max');
          }
        });
      }

      // refresh the consumption
      this.refreshConsumption(partList, sheet);

      // resolve the promise
      resolve();
    });
  }


  // get all the alerts
  getAlerts() {
    let alerts = [];

    // Check negative input power (sourcing instead of sinking)
    for(let valType of ['typ', 'max']) {
      let pin = this.getInputPower(valType);
      if(pin < 0) {
        alerts.push(`P<sub>IN ${valType.toUpperCase()}</sub> is negative (${pin}W): the load is sourcing instead of sinking.`);
      }
    }

    return alerts;
  }


  // Import an item data
  import(data) {
    // natively import the item with the parent method
    data = super.import(data);

    // compatibility with < v1.4.0
    // conversions of old characs.isinpartlist to new characs.valtyp
    if(undefined === this.characs.loadtype) {
      this.characs.loadtype = (properties.characs.inpartlist) ? 0 : 1;
    }

    return data;
  }


  // Refresh the consumption with the given partList
  refreshConsumption(partList, sheet) {
    // if the consumptions of this load are in the partlist
    // v < 1.4.0 compatibility: if the location do not exist, assume partlist
    if(undefined === this.characs.loadtype || 0 == this.characs.loadtype) {
      // skip if the partlist was not given
      if(partList) {
        // reinit each current
        this.characs.ityp = 0;
        this.characs.imax = 0;

        // iterate over all parts to add all currents
        partList.forEachPart((part) => {
          this.characs.ityp += parseFloat(part.getConsumption(this, 'typ'));
          this.characs.imax += parseFloat(part.getConsumption(this, 'max'));
        });
      }
    }
    // if the consumptions are raw
    else if(1 == this.characs.loadtype) {
      // do nothing
    }
    // if the consumptions are in the spreadsheet
    else if(2 == this.characs.loadtype) {
      // if there is no sheet
      if(undefined === sheet || null === sheet) {
        // reinit values
        this.characs.ityp = 0;
        this.characs.imax = 0;
      }
      // if there is a sheet
      else {
        const XLSX = require('xlsx');
        for(let typmax of ['typ','max']) {
          // init current
          let i=0;
          // convert the cell adress to indexes, B8 -> {c:1,r:7}
          let cell_index = XLSX.utils.decode_cell(this.characs['cell'+typmax]);
          // if the cell exists
          if(undefined !== sheet[cell_index.r] && undefined !== sheet[cell_index.r][cell_index.c]) {
            // get the value from the sheet
            i = parseFloat(sheet[cell_index.r][cell_index.c]);
          }
          // check if the value is a number
          if(isNaN(i)) i = 0;
          // save the values
          this.characs['i'+typmax] = i;

        }
      }
    }
  }
}

module.exports = Load;
