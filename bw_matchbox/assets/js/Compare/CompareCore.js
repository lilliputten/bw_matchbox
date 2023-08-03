modules.define(
  'CompareCore',
  [
    // Required modules...
    'CommonHelpers',
    'CompareRowsHelpers',
    'CompareRowClick',
  ],
  function provide_CompareCore(
    provide,
    // Resolved modules...
    CommonHelpers,
    CompareRowsHelpers,
    CompareRowClick,
  ) {
    /* Compare tables feature code (via global variable `CompareCore`).
     *
     * Mouse handler methods are used:
     * - CompareRowsHelpers.clickRow -- Click on regular row to select or collapse selected rows.
     * - CompareRowsHelpers.clickUncollapseRow -- Click on collapsed row handler to uncollapse.
     * - CompareRowClick.disableRowClick -- To disable row click effect (if we have some nested interactive elements).
     * - CompareCore.removeRow
     * - CompareCore.expandRow
     * - CompareCore.editNumber
     * - CompareCore.shiftRow
     * - CompareCore.replaceAmountRow
     * - CompareCore.setNumber
     * - CompareCore.setNewNumber
     * - CompareCore.rescaleAmount
     * - CompareCore.replaceWithTarget
     *
     * Data table record types:
     *
     * interface TDataRecord {
     *   amount: number; // 7.135225509515751e-9
     *   amount_display: string; // "7.1e-09"
     *   input_id: number; // 633
     *   location: string; // "United States"
     *   name: string; // "Clothing; at manufacturer"
     *   row_id: string; // "0" (auto increment primary key; initilizes dynamically on the client from the first iteration)
     *   unit: string; // ""
     *   url: string; // "/process/633"
     *   collapsed: boolean; // true
     *   collapsed-group: string; // "Collapsed-XXX-YYYYYY" -- unique key to locate corresponding pair.
     * }
     */

    // Define module...

    const CompareCore = {
      // External data...
      sharedData: undefined, // Initializing in `CompareCore.start` from `bw_matchbox/assets/templates/compare.html`

      // Local data...
      comment: '',
      modal: undefined, // HTMLDivElement -- modal window node

      // Methods...

      shiftRow: function (event, row, row_id) {
        CompareRowClick.disableRowClick();
        // Add row from source to target array
        event.preventDefault();
        row.parentElement.parentElement.classList.add('shift-right');
        const obj = CompareCore.sharedData.source_data.find((item) => item.row_id == row_id);
        CompareCore.sharedData.target_data.push(obj);
        CompareCore.build_table('target-table', CompareCore.sharedData.target_data, true);
        CompareCore.comment += `* Added source exchange of ${obj.amount} ${obj.unit} ${obj.name} in ${obj.location}.\n`;
        row.parentElement.innerHTML = `<i class="fa-solid fa-check"></i>`;
      },

      build_row: function (data, is_target) {
        const { collapsedRows } = CompareRowsHelpers;
        const {
          collapsed,
          row_id: rowId,
          url,
          location,
          unit,
          amount_display,
          amount,
          name,
          input_id,
        } = data;
        const rowKind = is_target ? 'target' : 'source';
        const collapsedId = CompareRowsHelpers.getCollapsedId(rowKind, rowId);
        if (collapsed && !collapsedRows[collapsedId]) {
          const otherRowKind = !is_target ? 'target' : 'source';
          const otherTableDataKey = otherRowKind + '_data';
          const otherTableData = CompareCore.sharedData[otherTableDataKey];
          const collapsedGroupId = data['collapsed-group'];
          const otherRowId = otherTableData.findIndex(
            (other) => other['collapsed-group'] === collapsedGroupId,
          );
          // const otherRowData = otherRowId !== -1 && otherTableData[otherRowId]; // UNUSED
          const otherCollapsedId = CompareRowsHelpers.getCollapsedId(otherRowKind, otherRowId);
          collapsedRows[collapsedId] = {
            rowKind,
            rowId,
            pairId: otherRowId,
            // rowEl, // OBSOLETE: Avoid of use it.
          };
          if (!collapsedRows[otherCollapsedId]) {
            collapsedRows[otherCollapsedId] = {
              rowKind: otherRowKind,
              rowId: otherRowId,
              pairId: rowId,
              // rowEl, // OBSOLETE: Avoid of use it.
            };
          }
        }
        // Detect if row is collapsed, then render correspound class (`collapsed`) and append handler node...
        const isCollapsed = !!collapsedRows[collapsedId];
        const collapsedRowHtml =
          isCollapsed && CompareRowsHelpers.buildCollapsedHandlerRow(rowKind, rowId, data);
        // Create class name...
        const className = [isCollapsed && 'collapsed'].filter(Boolean).join(' ');
        const attrs = [['class', className], isCollapsed && ['collapsed-id', collapsedId]]
          .filter(Boolean)
          .map(([name, value]) => value && name + '="' + CommonHelpers.quoteHtmlAttr(value) + '"')
          .filter(Boolean)
          .join(' ');
        const start = `<tr
          ${attrs}
          row_id="${rowId}"
          onClick="CompareCore.clickRow(this)"
        >`;
        /* // DEBUG: TODO: To move to tests?
         * if (useDebug && !rowId && !is_target) {
         *   // Emulate long-long unfittable/unbreakable line...
         *   name += ' extra_long_unwrappable_text_line_1';
         *   // name += ' extra_long_unwrappable_text_line_1_extra_long_unwrappable_text_line_2';
         * }
         */
        const end = `<td class="cell-name"><div><a
            onClick="CompareCore.disableRowClick(this)"
            href="${url}">${name}</a></div></td>
          <td class="cell-location"><div>${location}</div></td>
          <td class="cell-unit"><div>${unit}</div></td>
        </tr>`;
        let content;
        if (is_target) {
          content = `
            <td class="cell-actions" row_id="${rowId}"><div>
              <span
                id="row-trash-${rowId}"
              ><a
                onClick="CompareCore.removeRow(this)"
                title="Remove row"
              ><i
                class="fa-solid fa-trash-can"></i></a></span>
              &nbsp;
              <span
                input_id="${input_id}"
                amount="${amount}"><a
                  onClick="CompareCore.expandRow(this)"
                  title="Expand row"
                ><i
                class="fa-solid fa-diamond fa-spin"></i></a></span>
            </div></td>
            <td
              class="cell-amount"
              row_id="${rowId}"><div><a onClick="CompareCore.editNumber(this)">${amount_display}</a></div></td>
        `;
        } else {
          content = `
            <td class="cell-actions">
              <div><a
                onClick="CompareCore.shiftRow(event, this, ${rowId})"
                title="Shift row"
              ><i
              class="fa-solid fa-arrow-right"></i></a></div>
            </td>
            <td class="cell-amount">
              <div>${amount_display}</div>
            </td>`;
        }
        // TODO: Use trim and join with '\b'?
        return [start, content, end, collapsedRowHtml].filter(Boolean).join('');
      },

      build_table: function (table_id, data, is_target) {
        data.sort(CommonHelpers.numberSorter);
        let rows = '';
        for (const [index, obj] of data.entries()) {
          obj['row_id'] = `${index}`; // TODO: Is it ok to make server data 'dirty'?
          rows += CompareCore.build_row(obj, is_target);
        }
        const header = `
          <thead>
            <tr>
              <th class="cell-actions" title="Action"><div>Action</div></th>
              <th class="cell-amount" title="Amount"><div>Amount</div></th>
              <th class="cell-name" title="Name"><div>Name</div></th>
              <th class="cell-location" title="Location"><div>Location</div></th>
              <th class="cell-unit" title="Unit"><div>Unit</div></th>
            </tr>
          </thead>
        `;
        const content = `
          <tbody>
            ${rows}
          </tbody>
        `;
        document.getElementById(table_id).innerHTML = header + content;
      },

      createOneToOneProxyFunc: function (event) {
        event.preventDefault();

        const submission_data = {
          exchanges: [{ input_id: CompareCore.sharedData.target_id, amount: 1.0 }],
          source: CompareCore.sharedData.source_id,
          comment: 'One-to-one proxy',
          name:
            'Proxy for ' +
            CompareCore.sharedData.target_name
              .replace('Market group for ', '')
              .replace('market group for ', '')
              .replace('Market for ', '')
              .replace('market for ', '')
              .trim(),
        };
        const url = '/create-proxy/';
        fetch(url, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submission_data),
        }).then((response) => {
          if (response.redirected) {
            window.location.href = response.url;
          }
        });
      },

      createProxyFunc: function (event) {
        event.preventDefault();
        const span = document.getElementById('modal-content-wrapper');
        const title = 'Proxy name';
        const name =
          'Proxy for ' +
          CompareCore.sharedData.target_name
            .replace('Market group for ', '')
            .replace('market group for ', '')
            .replace('Market for ', '')
            .replace('market for ', '')
            .trim();
        let text = `
          <form>
            <!--
            <label for="proxy-name">${title}</label>
            -->
            <input class="u-full-width" type="text" id="proxy-name" name="proxy-name" value="${name}">
            <label for="proxy-comment">Comment</label>
            <textarea class="u-full-width" id="proxy-comment" name="proxy-comment">${CompareCore.comment}</textarea>
            <p><button class="button-primary" id="create-proxy-submit-button">Create Proxy Process</button> | Unit: ${CompareCore.sharedData.source_node_unit} | Location: ${CompareCore.sharedData.source_node_location}</p>
            <table width="100%">
              <tr>
                <th>Name</th>
                <th>Amount</th>
                <th>Comment</th>
              </tr>
        `;

        CompareCore.sharedData.target_data.forEach(function (item, _index) {
          text += `
              <tr input_id=${item.input_id}>
                <td><div>${item.name}</div></td>
                <td><div>${item.amount_display}</div></td>
                <td><div><textarea type="text" id="proxy-name-${item.input_id}" name="proxy-name-${item.input_id}"></textarea></div></td>
              </tr>
          `;
        });

        text += `
            </table>
          </form>
        `;
        span.innerHTML = text;

        // CompareCore.modal.style.display = 'block';
        this.showModal({ title });

        const submit = document.getElementById('create-proxy-submit-button');
        submit.addEventListener('click', async (e) => {
          e.preventDefault();
          const submission_data = {
            exchanges: CompareCore.sharedData.target_data,
            source: CompareCore.sharedData.source_id,
            comment: document.getElementById('proxy-comment').value,
            name: document.getElementById('proxy-name').value,
          };
          const url = '/create-proxy/';
          fetch(url, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submission_data),
          }).then((response) => {
            if (response.redirected) {
              window.location.href = response.url;
            }
          });
        });
      },

      replaceWithTarget: function (elem) {
        CompareRowClick.disableRowClick();
        CompareCore.sharedData.target_data.push(CompareCore.sharedData.target_node);
        CompareCore.sharedData.target_data.splice(0, CompareCore.sharedData.target_data.length - 1);
        CompareCore.comment += `* Collapsed input exchanges to target node\n`;
        CompareCore.build_table('target-table', CompareCore.sharedData.target_data, true);
        elem.innerHTML = '';
      },

      removeRow: function (element) {
        CompareRowClick.disableRowClick();
        const row_id = element.parentElement.getAttribute('row_id');

        function removeValue(obj, index, arr) {
          if (obj.row_id == row_id) {
            CompareCore.comment += `* Removed exchange of ${obj.amount} ${obj.unit} ${obj.name} from ${obj.location}.\n`;
            arr.splice(index, 1);
            return true;
          }
          return false;
        }
        CompareCore.sharedData.target_data.filter(removeValue);
        CompareCore.build_table('target-table', CompareCore.sharedData.target_data, true);
      },

      expandRow: function (element) {
        CompareRowClick.disableRowClick();
        const url =
          '/expand/' +
          element.getAttribute('input_id') +
          '/' +
          element.getAttribute('amount') +
          '/';
        const t = CompareCore.sharedData.target_data.find(
          (item) => item.input_id == element.getAttribute('input_id'),
        );
        CompareCore.comment += `* Expanded process inputs of ${t.amount} ${t.unit} from ${t.name} in ${t.location}.\n`;
        fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            data.forEach(function (item, _index) {
              CompareCore.sharedData.target_data.push(item);
            });
            CompareCore.sharedData.target_data.sort(CommonHelpers.numberSorter);
            CompareCore.removeRow(element);
          });
      },

      replaceAmountRow: function (elem, target_id) {
        CompareRowClick.disableRowClick();
        const s = CompareCore.sharedData.source_data.find(
          (item) => item.row_id == elem.getAttribute('source_id'),
        );
        const t = CompareCore.sharedData.target_data.find((item) => item.row_id == target_id);
        CompareCore.comment += `* Used source database amount ${s.amount} ${s.unit} from ${s.name} in ${s.location} instead of ${t.amount} ${t.unit} from ${t.name} in ${t.location}.\n`;
        document.getElementById('number-current-amount').innerText = elem.getAttribute('amount');
      },

      rescaleAmount: function (target_id) {
        CompareRowClick.disableRowClick();
        const t = CompareCore.sharedData.target_data.find((item) => item.row_id == target_id);
        const scale = Number(document.getElementById('rescale_number').value);
        const node = document.getElementById('number-current-amount');
        if (scale != 1) {
          CompareCore.comment += `* Rescaled amount ${t.amount} ${t.unit} from ${t.name} in ${t.location} by ${scale}.\n`;
        }
        node.innerText = Number(node.innerText) * scale;
      },

      setNewNumber: function (target_id) {
        CompareRowClick.disableRowClick();
        const t = CompareCore.sharedData.target_data.find((item) => item.row_id == target_id);
        const new_value = document.getElementById('new_number').value;
        CompareCore.comment += `* Set manual exchange value of ${new_value} instead of ${t.amount} ${t.unit} for ${t.name} in ${t.location}.\n`;
        document.getElementById('number-current-amount').innerText = new_value;
      },

      setNumber: function (elem) {
        CompareRowClick.disableRowClick();
        const row_id = elem.getAttribute('row_id');
        const current = Number(document.getElementById('number-current-amount').innerText);
        CompareCore.sharedData.target_data.forEach(function (item, _index) {
          if (item.row_id == row_id) {
            item.amount = current;
            item.amount_display = current.toExponential();
          }
        });
        // CompareCore.modal.style.display = 'none';
        this.hideModal();
        CompareCore.build_table('target-table', CompareCore.sharedData.target_data, true);
      },

      editNumber: function (link) {
        const td = link.closest('td');
        CompareRowClick.disableRowClick();
        const row = CompareCore.sharedData.target_data.find(
          (item) => item.row_id == td.getAttribute('row_id'),
        );
        const span = document.getElementById('modal-content-wrapper');

        const title = [row.name, row.location, row.unit].filter(Boolean).join(' | ');

        let start = `
          <!--
          <h3 class="modal-title">${title}</h3>
          -->
          <div class="five columns">
            <p>Click on a row to take that value</p>
            <table width="100%">
              <tr>
                <th>Amount</th>
                <th>Name</th>
                <th>Unit</th>
              </tr>
        `;

        CompareCore.sharedData.source_data.forEach(function (item, _index) {
          start += `
            <tr amount="${item.amount}" source_id="${item.row_id}" onClick="CompareCore.replaceAmountRow(this, ${row.row_id})">
              <td><div>${item.amount_display}</div></td>
              <td><div>${item.name}</div></td>
              <td><div>${item.unit}</div></td>
            </tr>
          `;
        });

        const end = `
            </table>
          </div>
          <div class="five columns">
            <h4>Original amount: ${row.amount}</h4>
            <h4>Current amount: <span id="number-current-amount">${row.amount}</span></h4>
            <button class="button-primary" id="close-number-editor" row_id="${row.row_id}" onClick="CompareCore.setNumber(this)">Set and close</button>
            <form>
              <div>
                <label>Enter new amount</label>
                <input type="number" id="new_number" value="${row.amount}">
                <button onClick="CompareCore.setNewNumber(${row.row_id})" id="new-number-button">Set</button>
              </div>
              <hr />
              <div>
                <label>Rescale current amount</label>
                <input type="number" id="rescale_number" value="1.0">
                <button onClick="CompareCore.rescaleAmount(${row.row_id})" id="rescale-button">Rescale</button>
              </div>
            </form>
          </div>
        `;

        span.innerHTML = start + end;
        document
          .getElementById('rescale-button')
          .addEventListener('click', CompareCore.stop, false);
        document
          .getElementById('new-number-button')
          .addEventListener('click', CompareCore.stop, false);
        document
          .getElementById('close-number-editor')
          .addEventListener('click', CompareCore.stop, false);

        // CompareCore.modal.style.display = 'block';
        this.showModal({ title });
      },

      stop: function (event) {
        event.preventDefault();
      },

      /** showModal -- Show modal window
       * @param {object} [params] - Modal parameters
       * @param {string} [params.title] - Modal title
       */
      showModal: function (params = {}) {
        const { title } = params;
        // CompareCore.modal.style.display = 'block';
        CompareCore.modal.classList.toggle('show', true);
        document.body.classList.toggle('has-modal', true);
        // Update title (if passed)...
        if (title) {
          const titleEl = CompareCore.modal.getElementsByClassName('modal-title')[0];
          if (titleEl) {
            titleEl.innerHTML = title;
          }
        }
      },

      hideModal: function () {
        // CompareCore.modal.style.display = 'none';
        CompareCore.modal.classList.toggle('show', false);
        document.body.classList.toggle('has-modal', false);
      },

      // Start...

      /** start -- Initialize compare feature (entry point)
       * @param {object} sharedData -- See initialization in `bw_matchbox/assets/templates/compare.html`
       */
      start: function (sharedData) {
        // Save public data...
        this.sharedData = sharedData;
        CompareRowsHelpers.sharedData = sharedData;

        // Create tables...
        CompareCore.build_table('source-table', CompareCore.sharedData.source_data, false);
        CompareCore.build_table('target-table', CompareCore.sharedData.target_data, true);

        // Button handlers...
        document
          .getElementById('save-mapping-button')
          .addEventListener('click', CompareCore.createProxyFunc, false);
        document
          .getElementById('one-to-one')
          .addEventListener('click', CompareCore.createOneToOneProxyFunc, false);

        // Get modal node...
        CompareCore.modal = document.getElementById('modal-number-editor');

        // Link close modal button handler (TODO: To use more specific class name?)...
        const closer = document.getElementsByClassName('close')[0];
        if (closer) {
          closer.onclick = CompareCore.hideModal;
        }
      },

      // Re-exported handlers for access from the html code (only core module is exposed as global)...

      /** clickRow
       * @param {<TRowEl>} rowEl
       */
      clickRow: function (rowEl) {
        return CompareRowsHelpers.clickRow(rowEl);
      },

      /** clickUncollapseRow -- Uncollapse both rows for this clicked collpase handler
       * @param {<HTMLTableRowElement>} firstHandlerEl
       */
      clickUncollapseRow: function (firstHandlerEl) {
        return CompareRowsHelpers.clickUncollapseRow(firstHandlerEl);
      },

      disableRowClick() {
        return CompareRowClick.disableRowClick();
      },
    };

    provide(CompareCore);
  },
);
