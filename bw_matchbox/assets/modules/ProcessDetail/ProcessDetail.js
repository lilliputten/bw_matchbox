// @ts-check

import * as CommonHelpers from '../common/CommonHelpers.js';
import { commonModal } from '../common/CommonModal.js';

export const ProcessDetail = {
  // External data...
  sharedData: undefined, // Initializing in `ProcessDetail.start` from `bw_matchbox/assets/templates/process_detail.html`

  // Methods...

  setLoading(isLoading) {
    const rootEl = document.getElementById('process-detail');
    rootEl.classList.toggle('loading', !!isLoading);
  },

  setWaitlist(isWaitlist) {
    // Update root container state...
    const rootEl = document.getElementById('process-detail');
    rootEl.classList.toggle('waitlist', !!isWaitlist);
    // Update button...
    const waitlistButton = document.getElementById('mark-waitlist');
    // NOTE: `button-primary` = un-waitlised status
    waitlistButton.classList.toggle('button-primary', !isWaitlist);
    waitlistButton.innerText = isWaitlist ? 'Waitlisted' : 'Waitlist';
    // Update parameter in `sharedData`...
    const { sharedData } = this;
    sharedData.isWaitlist = isWaitlist;
  },

  /** setError -- Set and show error.
   * @param {string|Error|string[]|Error[]} error - Error or errors list.
   */
  setError(error) {
    const hasErrors = !!error;
    const rootEl = document.getElementById('process-detail');
    rootEl.classList.toggle('has-error', hasErrors);
    // Show error...
    const text = CommonHelpers.getErrorText(error);
    const errorEl = document.getElementById('error');
    errorEl.innerHTML = text;
  },

  clearError() {
    this.setError(undefined);
  },

  /** processMultipleRequestErrors
   * @param {Response[]} resList
   * @return {Error[]}
   */
  processMultipleRequestErrors(resList) {
    return resList
      .map((res) => {
        if (!res.ok) {
          return new Error(`Can't load url '${res.url}': ${res.statusText}, ${res.status}`);
        }
      })
      .filter(Boolean);
  },

  getMarkWaitlistDialogContent() {
    const content = `
      <div class="mark-waitlist-form">
        <label for="mark-waitlist-comment">Comment</label>
        <textarea class="u-full-width" id="mark-waitlist-comment" name="mark-waitlist-comment"></textarea>
      </div>
      <div class="mark-waitlist-actions">
        <button class="button-primary" id="mark-waitlist-ok">Ok</button>
        <button id="mark-waitlist-cancel">Cancel</button>
      </div>
    `;
    return content;
  },

  /** promiseMarkWaitlistDialog -- Show dialog and wait for action
   * @return {Promise}
   */
  promiseMarkWaitlistDialog() {
    return new Promise((resolve, reject) => {
      const title = 'Waitlist this process';
      const content = this.getMarkWaitlistDialogContent();
      let isOpened = true;
      commonModal
        .ensureInit()
        .then(() => {
          commonModal
            .setModalContentId('mark-waitlist-dialog-modal')
            .setTitle(title)
            .setModalWindowOptions({
              autoHeight: true,
              width: 'md',
            })
            .setModalContentOptions({
              scrollable: true,
              padded: true,
            })
            .setContent(content)
            .onHide(() => {
              // It will be called on modal close...
              if (isOpened) {
                isOpened = false;
                // Don't proceed the operation!
                resolve(false);
              }
            })
            .showModal();
          // Store comment value...
          /** @type {HTMLButtonElement} */
          const okButtonEl = document.querySelector('button#mark-waitlist-ok');
          // TODO: Add handlers for modal actions
          okButtonEl.addEventListener('click', () => {
            if (isOpened) {
              isOpened = false;
              commonModal.hideModal({ dontNotify: true });
              // Success: proceed with comment text
              /** @type {HTMLTextAreaElement} */
              const commentEl = document.querySelector('textarea#mark-waitlist-comment');
              const comment = commentEl.value;
              resolve({ comment, status: 'comment from promiseMarkWaitlistDialog' });
            }
          });
          document
            .getElementById('mark-waitlist-cancel')
            .addEventListener('click', commonModal.getBoundHideModal());
        })
        .catch(reject);
    });
  },

  /** doMarkWaitlist -- Send mark as waitlist requests
   * @param {object} userAction - Result of `promiseMarkWaitlistDialog` (`{ comment }` or `false`)
   */
  doMarkWaitlist(userAction) {
    const { comment = '' } = userAction;
    const { sharedData } = this;
    const { isWaitlist } = sharedData;
    const setWaitlist = !isWaitlist;
    const waitlistValue = setWaitlist ? 1 : 0;
    const { addAttributeUrl } = sharedData;
    const urlBase = addAttributeUrl;
    const makeUrlParams = { addQuestionSymbol: true, useEmptyStrings: true };
    const urls = [
      // Url #1, Eg: ?attr=match_type&value=1
      urlBase + CommonHelpers.makeQuery({ attr: 'waitlist', value: waitlistValue }, makeUrlParams),
      // Url #2, Eg: ?attr=waitlist_comment&value=<comment text>
      urlBase +
        CommonHelpers.makeQuery({ attr: 'waitlist_comment', value: comment }, makeUrlParams),
    ].filter(Boolean);
    // Call both requests at once...
    const callbacks = urls.map((url) => () => fetch(url));
    this.setLoading(true);
    // Run callbacks one by one...
    return CommonHelpers.runAsyncCallbacksSequentially(callbacks)
      .then((resList) => {
        const errorsList = this.processMultipleRequestErrors(resList);
        if (errorsList.length) {
          // Some errors?
          // eslint-disable-next-line no-console
          console.error('[ProcessDetail:doMarkWaitlist] Got errors', errorsList);
          // eslint-disable-next-line no-debugger
          debugger;
          // Show errors on the page...
          this.setError(errorsList);
        } else {
          // Success...
          this.setWaitlist(setWaitlist);
          this.clearError();
        }
      })
      .finally(() => {
        this.setLoading(false);
      });
  },

  /** markWaitlist -- Handler for 'Waitlist' button.
   */
  markWaitlist() {
    const { sharedData } = this;
    const { isWaitlist } = sharedData;
    const setWaitlist = !isWaitlist;
    const firstPromise = setWaitlist
      ? this.promiseMarkWaitlistDialog()
      : Promise.resolve({ status: 'no comment required for un-waitlist' });
    return (
      firstPromise
        .then((userAction) => {
          if (userAction) {
            return this.doMarkWaitlist(userAction);
          }
        })
        // Suppress exceptions on top-level handler (should be catched before)
        .catch((e) => e)
    );
  },

  /** markMatched -- Handler for 'No match needed' button.
   * @param {HTMLButtonElement} button
   */
  markMatched(button) {
    const { sharedData } = this;
    const urls = [sharedData.markMatchedUrl, sharedData.markMatchTypeUrl];
    const callbacks = urls.map((url) => () => fetch(url));
    this.setLoading(true);
    // Run callbacks one by one...
    return CommonHelpers.runAsyncCallbacksSequentially(callbacks)
      .then((resList) => {
        const errorsList = this.processMultipleRequestErrors(resList);
        if (errorsList.length) {
          // Some errors?
          // eslint-disable-next-line no-console
          console.error('[ProcessDetail:markMatched] Got errors', errorsList);
          // eslint-disable-next-line no-debugger
          debugger;
          // Show errors on the page...
          this.setError(errorsList);
        } else {
          // Success...
          button.innerText = 'Matched';
          button.classList.remove('button-primary');
          document.getElementById('match-button').style.display = 'none';
          document.getElementById('manual-multi-match').style.display = 'none';
          if (sharedData.multimatchi) {
            document.getElementById('manual-multi-match').style.display = 'none';
          }
          this.clearError();
        }
      })
      .finally(() => {
        this.setLoading(false);
      });
  },

  /** markAllMatched -- Handler for 'Mark all matched' button.
   * @param {HTMLButtonElement} button
   */
  markAllMatched(button) {
    const { sharedData } = this;
    const url = sharedData.markAllMatchedUrl;
    this.setLoading(true);
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          const error = new Error(`Can't load url '${res.url}': ${res.statusText}, ${res.status}`);
          // eslint-disable-next-line no-console
          console.error('[ProcessDetail:markAllMatched] Got error', error);
          // eslint-disable-next-line no-debugger
          debugger;
          // Show errors on the page...
          this.setError(error);
        } else {
          button.innerText = 'Matched';
          button.classList.remove('button-primary');
          document.getElementById('manual-match').style.display = 'none';
          document.getElementById('match-button').style.display = 'none';
          this.clearError();
        }
      })
      .finally(() => {
        this.setLoading(false);
      });
  },

  start(sharedData) {
    // Save public data...
    this.sharedData = sharedData;
    // Pre-initialize modal windows...
    commonModal.preInit();
  },
};
