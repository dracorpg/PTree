$(function() {
   // enable all tooltips
   $('[data-toggle="tooltip"]').tooltip({
      delay: {
         show: 1000,
         hide: 0
      },
      trigger: 'hover'
   });

   // init the two mains object of the partlist
   var partTable = new PartTable();

   // prepare to receive the init data from the main process
   require('electron').ipcRenderer.on('partTable-window-open', function(event, treeData, partListData) {

      // reconstruct a Tree and a PartList object
      partTable.tree.fromString(treeData);
      partTable.partList.fromString(partListData);
      partTable.clearHistory();

      // complete the header of the table withe the list of loads
      partTable.tree.forEachLoad(function(load) {
         if(load.isInPartlist()) {
            let th1 =  `<th colspan="2" class="th_current">${load.characs.name}</th>`;
            $('.tr_top > .th_power:last-child').before(th1);

            let th2 = '<th class="th_current th_typ">I<sub>TYP</sub></th>';
            let th3 = '<th class="th_current th_max">I<sub>MAX</sub></th>';

            $('.tr_bottom > .th_charac:nth-child(5)').after(th2, th3);
         }
      });

      // refresh the table to fill all data
      partTable.refresh();
   });
});
