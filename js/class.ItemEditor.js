// -----------------------------------------------------------------------------
// Item Editor Class
//    Handle the item editor window
// -----------------------------------------------------------------------------

class ItemEditor {

  constructor(item = null) {
    this.item     = item;
    this.effChart = null;

    this.listenEvents();

    this.updateHTML_form();
  }

  // fill the form with data from an item
  updateHTML_form() {
    if(null === this.item) return;

    // hide the reg form and the load form
    $('.form').hide();

    // get the value of all characteristics of the item
    for (let charac in this.item.characs) {
      if (Object.prototype.hasOwnProperty.call(this.item.characs, charac)) {
        // get the jquery element corresponding to the charac
        let input = $('#' + this.item.type + '_control *[data-itemdata=' + charac + ']');
        // if the element is a checkbox
        if('checkbox' === input.attr('type') && this.item.characs[charac]) {
          input.prop('checked','checked');
        }
        // if the element is a normal input
        else {
          input.val(this.item.characs[charac]);
        }
      }
    }

    // Update the html
    if(this.item.isSource()) {
      this.updateHTML_regType();
      $('#input_badge_in').attr('disabled', this.item.isChildOfRoot());
    }
    else if (this.item.isLoad()) {
      this.updateHTML_loadType();
    }

    // finaly show the form
    $('#' + this.item.type + '_control').show();
  }


  // update the load current helper
  updateHTML_loadType() {
    $('.loadtype').hide();
    let loadtype = $('#load_type').val();
    $(`.loadtype${loadtype}`).show();
  }


  // update the form according to the type of regulator
  updateHTML_regType() {

    // default display
    $('#source_adjustable').hide();
    $('#form-group-vout').show();

    // If the reg vout is fixed
    if (this.item.isFixedReg()) {
      $('.input_vout').attr('disabled', false);
    }
    // if the reg vout is adjustable
    else if (this.item.isAdjReg()) {
      // disable the fixed value and show the adj inputs
      $('#source_adjustable').show();
      $('.input_vout').attr('disabled', true);

      // update the voltage values
      this.updateHTML_regVoltage();
    }
    // if the reg is dummy
    else if (this.item.isDummy()) {
      $('#form-group-vout').hide();
    }
    // if the reg is perfect
    else if (this.item.isPerfect()) {
      $('.input_vout').attr('disabled', false);
    }

    // hide DC/DC and LDO inputs
    $('.source_dcdc').hide();
    $('.source_ldo').hide();

    // Show corresponding inputs if the reg is a DC/DC
    if (this.item.isDCDC()) {
      $('.source_dcdc').show();
      this.updateHTML_regEff();
    }
    // Show corresponding inputs if the reg is a LDO
    else if (this.item.isLDO()) {
      $('.source_ldo').show();
    }
  }


  // update regualor adjustable voltage
  updateHTML_regVoltage() {
    $('#input_vout_min').val(this.item.getVoltage('min', 'out', 3, false));
    $('#input_vout_typ').val(this.item.getVoltage('typ', 'out', 3, false));
    $('#input_vout_max').val(this.item.getVoltage('max', 'out', 3, false));
  }


  // update the DC/DC efficiency chart
  updateHTML_regEff() {
    // create a chart dataset from the item datas
    let dataset = [];
    for(let data of this.item.characs.efficiency) {
      dataset.push({x:data.i, y:data.eff});
    }

    // prepare the configuration of the chart
    let chartConfig = {
      type: 'scatter',
      data: {
        datasets: [{
          data:             dataset,
          showLine:         true,
          tension:          0,
          pointStyle:       'circle',
          radius:           4,
          backgroundColor:  'rgba(255,23,68,0.3)',
          borderColor:      'rgba(255,23,68,1)'
        }]
      },
      options: {
        legend: {
          display: false
        },
        // Client event
        onClick: (event, elements) => {
          // if click on a point, delete it and redraw the chart
          if(elements.length > 0) {
            this.item.characs.efficiency.splice(elements[0]._index,1);
            this.updateHTML_regEff();
          }
        }
      },
    };

    // erase the old chart
    if(null !== this.effChart) {
      this.effChart.destroy();
      this.effChart = {};
    }

    // load chart.js safely and create a new Chart.js
    const Chart = require('chart.js');
    Chart.platform.disableCSSInjection = true;
    this.effChart =  new Chart($('#effChart'), chartConfig);
  }


  // add a new point on the efficiency chartConfig
  addEfficiency() {
    // get the new data from the form
    let eff = parseFloat($('#input_eff').val());
    let i   = parseFloat($('#input_eff_i').val());

    this.item.addEfficiency(eff, i);

    // remove the data from the form
    $('#input_eff').val('');
    $('#input_eff_i').val('');

    // update the chart
    this.updateHTML_regEff();
  }


  // Update the item from the given jquery element
  updateItemFromHTML($elt) {
    // if the given elt has a charac name
    let charac = $elt.data('itemdata');
    if(undefined !== charac) {
      // update the charac with the value of the element
      this.item.characs[charac] = $elt.val();

      // if the elt is a source_adj, also update vmin/vtyp/vmax
      if($elt.hasClass('source_adj')) {
        let r1       = this.item.characs.r1;
        let r2       = this.item.characs.r2;
        let rtol     = this.item.characs.rtol;
        let vref_min = this.item.characs.vref_min;
        let vref_typ = this.item.characs.vref_typ;
        let vref_max = this.item.characs.vref_max;

        let rtolmax = 1 + rtol / 100;
        let rtolmin = 1 - rtol / 100;

        this.item.characs.vout_min = vref_min * ((r1 * rtolmin) / (r2 * rtolmax) + 1);
        this.item.characs.vout_typ = vref_typ * (r1 / r2 + 1);
        this.item.characs.vout_max = vref_max * ((r1 * rtolmax) / (r2 * rtolmin) + 1);
      }
    }
  }


  // Send new item to main.js and close the window
  closeOk() {
    // update the focused item (because it may not have trig 'change')
    this.updateItemFromHTML($(document.activeElement));
    // Send an IPC async msg to main.js: return the edited item
    require('electron').ipcRenderer.send('ItemEditor-returnData', this.item.toString());
    // close the window
    window.close();
  }


  // Send old, unmodifided, item to main.js and close the window
  closeCancel() {
    // Send an IPC async msg to main.js: return null instead of the item
    require('electron').ipcRenderer.send('ItemEditor-returnData', null);
    // close the window
    window.close();
  }


  // listen DOM events
  listenEvents() {
    // BT cancel clicked
    $('#edit_cancel').click(() => {
      this.closeCancel();
    });


    // BT OK clicked
    $('#edit_ok').click(() => {
      this.closeOk();
    });


    // BT + (efficiency) clicked
    $('#add_eff').click(() => {
      // add the new efficiency to the chart
      this.addEfficiency();
    });


    // Replace ',' by '.' on numeric inputs
    $('.input_num').keypress((event) => {
      if (44 == event.keyCode) {
        event.preventDefault();
        $(event.currentTarget).val($(event.currentTarget).val() + '.');
      }
    });


    // Replace lowercase by uppercase and ignore none alpha numeric on cell inputs
    $('.input_cell').keypress((event) => {
      // check the pressed key
      let match = event.key.match(/([A-Z0-9])|([a-z])/);
      // if the key is not a letter nor a number, ignore it
      if(null === match) {
        event.preventDefault();
      }
      // if the key is a lowercase letter, transform it to uppercase
      else if(undefined !== match[2]) {
        event.preventDefault();
        let val = $(event.currentTarget).val();
        let start = val.substring(0, event.currentTarget.selectionStart);
        let end = val.substring(event.currentTarget.selectionEnd, val.length);
        $(event.currentTarget).val(start + match[2].toUpperCase() + end);
      }
      // if the key is an uppercase letter or a numbe
      else if(undefined !== match[1]) {
        // do nothing
      }
    });


    // update the item every time an input change
    $('.form-control').change((event) => {
      // save a ref to the jquery elt
      let $elt = $(event.currentTarget);

      // if the input is numeric
      if($elt.hasClass('input_num')) {
        // if the value of the input is not a number
        if('' === $elt.val() || isNaN($elt.val())) {
          $elt.val('0');
        }
      }

      // update the item with the value of $(event.currentTarget)
      this.updateItemFromHTML($elt);

      // Modify the available inputs when the user change the regtype
      if('source_regtype' === $elt.prop('id')){
        this.updateHTML_regType();
      }
      // Modify the available inputs when the user change the loadtype
      else if('load_type' === $elt.prop('id')){
        this.updateHTML_loadType();
      }
      // update vmin/vtyp/vmax if any adj property has changed
      else if($elt.hasClass('source_adj')){
        this.updateHTML_regVoltage();
      }
    });


    // Trigger key press
    $(document).keydown((event) => {
      // ESCAPE
      if (27 == event.keyCode) {
        this.closeCancel();
      }
      // ENTER
      else if (13 == event.keyCode) {
        // editing efficiency, add it
        if(event.target.id === 'input_eff' || event.target.id === 'input_eff_i') {
          this.addEfficiency();
        }
        // else, validate the editon
        else {
          this.closeOk();
        }
      }
    });
  }
}

module.exports = ItemEditor;
