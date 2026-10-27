<template>
  <div style="width: 100%; height: 100%">
    <Toast />
    <ProgressBar
      mode="indeterminate"
      :style="{ height: '0.3em', visibility: showProgressBar ? 'visible' : 'hidden' }"
    />
    <div v-if="user">
      <!-- The call a link named (?conversation=<id>), from a call email: shown open at the top of
           the page, above the views and the filters, which would push it below the fold on a phone,
           and outside whatever view the list is in, since it may sit in the archive or the trash -->
      <div v-if="openedId" class="conversation-table-container">
        <div v-if="opened" class="conversation-card opened-card">
          <div class="opened-label">
            {{ $t("components.conversations.details.openedFromLink") }}
            <span v-if="opened.deleted" class="opened-state">{{ $t("components.conversations.details.inTrash") }}</span>
            <span v-else-if="opened.archived" class="opened-state">{{ $t("components.conversations.details.inArchive") }}</span>
          </div>
          <p v-if="notOwner" class="read-only-note">{{ $t("components.callInsights.feedback.readOnly.title") }}</p>
          <div class="card-header">
            <div class="contact-info">
              <span class="contact-name">{{ callerName(opened) }}</span>
              <span v-if="opened.contactNumber" class="contact-number">{{ opened.contactNumber }}</span>
            </div>
            <div class="timestamp-section">
              <span class="timestamp">{{ timestampToDate(opened.startTimestamp) }}</span>
            </div>
            <button
              type="button"
              class="action-btn"
              :title="$t('components.conversations.details.closeOpened')"
              :aria-label="$t('components.conversations.details.closeOpened')"
              @click="closeOpened"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>
          <CallDetailsPanel
            :key="opened.id"
            :conversation="opened"
            :business-id="businessId"
            :user="user"
            :expanded="true"
            :eager="true"
            :read-only="readOnly"
            :with-judgements="true"
            @error="recordingFailed"
          />
        </div>
        <div v-else-if="openedState === 'missing'" class="conversation-card opened-card">
          <p class="opened-missing">{{ $t("components.conversations.details.openedMissing") }}</p>
        </div>
      </div>

      <!-- A non-owner's page (an admin, a reseller): read-only, every call opened recorded (StarChat decision 14) -->
      <div v-if="readerKnown && notOwner" class="conversation-table-container">
        <div class="read-only-banner" role="note">
          <i class="pi pi-eye" aria-hidden="true"></i>
          <span><strong>{{ $t("components.callInsights.feedback.readOnly.title") }}</strong> · {{ $t("components.callInsights.feedback.readOnly.note") }}</span>
        </div>
      </div>
      <!-- The business could not be read: whether the reader owns these calls is not known. Its controls stay (StarChat
           refuses an owner-only write to anyone else); no call or judgement is read on its own until it is known. -->
      <div v-if="readerKnown && ownership === null && businessId" class="conversation-table-container">
        <div class="read-only-banner" role="status">
          <span>{{ $t("components.callInsights.feedback.readOnly.unknown") }}</span>
          <Button type="button" size="small" text :label="$t('components.callInsights.state.retry')" @click="readBusiness" />
        </div>
      </div>

      <!-- The filters a count's link carried, each undone by its own chip; a value not recognised is said, not applied -->
      <div v-if="addressChips.length > 0 || addressUnknown.length > 0" class="conversation-table-container">
        <div class="address-filters" :aria-label="$t('components.callInsights.feedback.filters.title')" role="group">
          <span v-for="c in addressChips" :key="c.key" class="address-chip">
            <span>{{ c.text }}</span>
            <button type="button" class="address-chip-clear" :aria-label="$t('components.callInsights.feedback.filters.remove', { filter: c.text })" @click="removeAddressFilter(c.key)">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </span>
          <p v-if="addressUnknown.length > 0" class="address-unknown" role="status">{{ $t("components.callInsights.feedback.filters.unknown") }}</p>
          <p v-if="leftOut > 0" class="address-unknown" role="status">{{ $t("components.callInsights.feedback.filters.leftOut", { n: leftOut }, leftOut) }}</p>
        </div>
      </div>

      <!-- View Switcher -->
      <div v-if="queryConvResultReady" class="conversation-table-container">
        <div class="view-switcher">
          <SelectButton
            v-model="activeView"
            :options="viewOptions"
            optionLabel="label"
            optionValue="value"
            :allowEmpty="false"
          >
            <template #option="slotProps">
              <div class="view-option">
                <i :class="slotProps.option.icon"></i>
                <span>{{ slotProps.option.label }}</span>
                <span
                  v-if="slotProps.option.value === 'inbox' && unreadCount > 0"
                  class="unread-badge"
                >
                  {{ unreadCount }}
                </span>
              </div>
            </template>
          </SelectButton>
        </div>
      </div>

      <!-- Filters Section - Always visible when queryConvResultReady -->
      <div v-if="queryConvResultReady" class="conversation-table-container">
        <div class="filters-card">
          <div class="filters-header">
            <span class="filters-title">{{
              $t("components.conversations.filterTitle")
            }}</span>
          </div>

          <div class="filters-content">
            <!-- Date Range Row -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-calendar"></i>
                {{ $t("components.conversations.dateRangeLabel") }}
              </label>
              <div class="filter-control">
                <Calendar
                  style="flex: 1"
                  selectionMode="range"
                  v-model="rangeValue"
                  :manualInput="true"
                  :touchUI="true"
                  :showIcon="true"
                  :showButtonBar="true"
                  :showTime="true"
                  :showSeconds="true"
                  :placeholder="
                    $t('components.conversations.dateRangePlaceholder')
                  "
                />
                <button
                  v-if="rangeValue && rangeValue[0]"
                  type="button"
                  class="clear-btn"
                  @click="clearDateFilter"
                >
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </div>

            <!-- What the call said (brief outcome 2, insights version 2): resolution and message are
                 the assistant's own judgement and carry the marking, booked and transferred are
                 facts the server recorded. -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-check-circle"></i>
                {{ $t("components.callInsights.dimensions.resolution") }}
                <Tag severity="secondary" :value="$t('components.callInsights.assessedMarking')" class="insight-assessed-tag" />
              </label>
              <div class="filter-control">
                <Dropdown
                  v-model="resolutionFilter"
                  :options="resolutionOptions"
                  optionLabel="label"
                  optionValue="value"
                  :showClear="true"
                  :ariaLabel="$t('components.callInsights.dimensions.resolution')"
                  :placeholder="$t('components.callInsights.filters.resolutionPlaceholder')"
                />
              </div>
            </div>

            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-comment"></i>
                {{ $t("components.callInsights.dimensions.message") }}
                <Tag severity="secondary" :value="$t('components.callInsights.assessedMarking')" class="insight-assessed-tag" />
              </label>
              <div class="filter-control">
                <Dropdown
                  v-model="messageFilter"
                  :options="messageOptions"
                  optionLabel="label"
                  optionValue="value"
                  :showClear="true"
                  :ariaLabel="$t('components.callInsights.dimensions.message')"
                  :placeholder="$t('components.callInsights.filters.messagePlaceholder')"
                />
              </div>
            </div>

            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-calendar-plus"></i>
                {{ $t("components.callInsights.dimensions.booked") }}
              </label>
              <div class="filter-control">
                <Dropdown
                  v-model="bookedFilter"
                  :options="bookedOptions"
                  optionLabel="label"
                  optionValue="value"
                  :showClear="true"
                  :ariaLabel="$t('components.callInsights.dimensions.booked')"
                  :placeholder="$t('components.callInsights.filters.bookedPlaceholder')"
                />
              </div>
            </div>

            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-phone"></i>
                {{ $t("components.callInsights.dimensions.transferred") }}
              </label>
              <div class="toggle-control">
                <ToggleButton
                  v-model="transferredFilter"
                  :onLabel="$t('components.callInsights.filters.transferredOn')"
                  :offLabel="$t('components.callInsights.filters.transferredOff')"
                  :ariaLabel="$t('components.callInsights.transferred.true')"
                />
              </div>
            </div>

            <!-- Unanswered Questions Row -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-question-circle"></i>
                {{ $t("components.callInsights.filters.unansweredLabel") }}
              </label>
              <div class="toggle-control">
                <ToggleButton
                  v-model="unansweredFilter"
                  :onLabel="$t('components.callInsights.filters.unansweredOn')"
                  :offLabel="$t('components.callInsights.filters.unansweredOff')"
                  :ariaLabel="$t('components.callInsights.filters.unansweredLabel')"
                />
              </div>
            </div>

            <!-- View Mode Row -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-eye"></i>
                {{ $t("components.conversations.viewModeLabel") }}
              </label>
              <div class="toggle-control">
                <ToggleSwitch v-model="messagesExpanded" />
                <span class="toggle-label">
                  {{
                    messagesExpanded
                      ? $t("components.conversations.expandedView")
                      : $t("components.conversations.collapsedView")
                  }}
                </span>
              </div>
            </div>

            <!-- Hide Read Toggle Row -->
            <div class="filter-row">
              <label class="filter-label">
                <i class="pi pi-list-check"></i>
                {{ $t("components.conversations.hideReadLabel") }}
              </label>
              <div class="toggle-control">
                <ToggleSwitch v-model="hideRead" />
                <span class="toggle-label">
                  {{
                    hideRead
                      ? $t("components.conversations.hideReadOn")
                      : $t("components.conversations.hideReadOff")
                  }}
                </span>
              </div>
            </div>

            <!-- Export Row: the owner's only (StarChat answers 403 owner_only to anyone else) -->
            <div v-if="!notOwner" class="filter-row">
              <label class="filter-label">
                <i class="pi pi-download"></i>
                {{ $t("components.conversations.exportLabel") }}
              </label>
              <div class="export-buttons">
                <Button
                  label="TSV"
                  icon="pi pi-file"
                  size="small"
                  outlined
                  @click="downloadItemsTsv()"
                />
                <Button
                  label="JSON"
                  icon="pi pi-file"
                  size="small"
                  outlined
                  @click="downloadItemsJson()"
                />
              </div>
            </div>

            <!-- Bulk Actions Row: archive and delete are the owner's only -->
            <div v-if="!notOwner" class="filter-row">
              <label class="filter-label">
                <i class="pi pi-list-check"></i>
                {{ $t("components.conversations.bulkActionsLabel") }}
              </label>
              <div class="export-buttons">
                <Button
                  v-if="activeView === 'inbox'"
                  :label="$t('components.conversations.actions.archiveAll')"
                  icon="pi pi-box"
                  size="small"
                  outlined
                  :disabled="totalHits === 0"
                  @click="bulkArchiveAll()"
                />
                <Button
                  v-if="activeView === 'inbox' || activeView === 'archive'"
                  :label="$t('components.conversations.actions.deleteAll')"
                  icon="pi pi-trash"
                  size="small"
                  class="btn-delete-all"
                  :disabled="totalHits === 0"
                  @click="bulkDeleteAll()"
                />
                <Button
                  v-if="activeView === 'archive'"
                  :label="$t('components.conversations.actions.moveAllToInbox')"
                  icon="pi pi-inbox"
                  size="small"
                  outlined
                  :disabled="totalHits === 0"
                  @click="bulkUnarchiveAll()"
                />
                <Button
                  v-if="activeView === 'trash'"
                  :label="$t('components.conversations.actions.restoreAll')"
                  icon="pi pi-undo"
                  size="small"
                  outlined
                  :disabled="totalHits === 0"
                  @click="bulkRestoreAll()"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Results section - only when there are results -->
      <div v-if="totalHits > 0 && queryConvResultReady">
        <div class="conversation-table-container">
          <Paginator
            :template="{
              '640px': 'PrevPageLink CurrentPageReport NextPageLink',
              '960px':
                'FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
              '1300px':
                'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink',
              default:
                'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink JumpToPageDropdown RowsPerPageDropdown',
            }"
            :alwaysShow="true"
            :rows="size"
            v-model:first="first"
            :rowsPerPageOptions="[10, 20, 30, 50, 100]"
            :totalRecords="totalHits"
            @page="onPage($event)"
          />
        </div>

        <!-- Conversation Cards -->
        <div id="results" class="conversation-table-container">
          <div class="conversations-list">
            <div
              v-for="[key, conversation] in filteredItems"
              :key="key"
              class="conversation-card"
              :class="{
                'unread': !notOwner && !isRead(conversation),
                'animating-out': animatingOut.has(key),
                'selected-card': selection.has(key)
              }"
              @pointerdown="selection.pressStart(key, $event)"
              @pointerup="selection.pressEnd()"
              @pointerleave="selection.pressEnd()"
              @pointercancel="selection.pressEnd()"
            >
              <div class="card-header">
                <!-- the selection: always on a wide screen, after a long press on a narrow one -->
                <input
                  v-if="selection.showChecks"
                  type="checkbox"
                  class="select-check"
                  :checked="selection.has(key)"
                  :aria-label="$t('components.callInsights.feedback.bulk.select', { name: callerName(conversation) })"
                  @change="selectRow(key, $event.target.checked)"
                />
                <div class="contact-info">
                  <span class="contact-name">
                    <span v-if="!notOwner && !isRead(conversation)" class="unread-dot"></span>
                    {{ callerName(conversation) }}
                  </span>
                  <span
                    v-if="conversation.contactNumber"
                    class="contact-number"
                  >
                    {{ conversation.contactNumber }}
                  </span>
                </div>
                <div class="timestamp-section">
                  <span
                    class="timestamp"
                    :class="{ 'timestamp-unread': !isRead(conversation) }"
                    :title="timestampToDate(conversation.startTimestamp)"
                  >
                    {{ getRelativeTime(conversation.startTimestamp) }}
                  </span>
                </div>

                <!-- A non-owner's row is reduced: the call is opened, and recorded, only when asked -->
                <Button
                  v-if="notOwner"
                  type="button" size="small" outlined
                  class="open-call-btn"
                  :label="$t('components.callInsights.feedback.readOnly.open')"
                  @click.stop="openFromList(key)"
                />

                <!-- Read/Unread toggle (always visible) -->
                <button
                  v-if="!notOwner"
                  type="button"
                  class="action-btn action-btn-read"
                  :title="isRead(conversation)
                    ? $t('components.conversations.actions.markAsUnread')
                    : $t('components.conversations.actions.markAsRead')"
                  :disabled="actionInProgress.has(key)"
                  @click.stop="toggleReadStatus(key, conversation)"
                >
                  <i :class="isRead(conversation) ? 'pi pi-check-square' : 'pi pi-check'"></i>
                </button>

                <!-- Desktop Actions (hover reveal) -->
                <div v-if="!notOwner" class="desktop-actions">
                  <template v-if="activeView === 'inbox'">
                    <button
                      type="button"
                      class="action-btn"
                      :title="$t('components.conversations.actions.archive')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="archiveConversation(key, conversation)"
                    >
                      <i class="pi pi-box"></i>
                    </button>
                    <button
                      type="button"
                      class="action-btn action-btn-danger"
                      :title="$t('components.conversations.actions.delete')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="deleteConversation(key, conversation)"
                    >
                      <i class="pi pi-trash"></i>
                    </button>
                  </template>
                  <template v-else-if="activeView === 'archive'">
                    <button
                      type="button"
                      class="action-btn"
                      :title="$t('components.conversations.actions.unarchive')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="unarchiveConversation(key, conversation)"
                    >
                      <i class="pi pi-inbox"></i>
                    </button>
                    <button
                      type="button"
                      class="action-btn action-btn-danger"
                      :title="$t('components.conversations.actions.delete')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="deleteConversation(key, conversation)"
                    >
                      <i class="pi pi-trash"></i>
                    </button>
                  </template>
                  <template v-else-if="activeView === 'trash'">
                    <button
                      type="button"
                      class="action-btn"
                      :title="$t('components.conversations.actions.restore')"
                      :disabled="actionInProgress.has(key)"
                      @click.stop="restoreConversation(key, conversation)"
                    >
                      <i class="pi pi-undo"></i>
                    </button>
                  </template>
                </div>

                <!-- Mobile Actions (3-dot menu) -->
                <div v-if="!notOwner" class="mobile-action-trigger">
                  <button
                    type="button"
                    class="action-btn"
                    :disabled="actionInProgress.has(key)"
                    @click.stop="openMobileMenu($event, key, conversation)"
                  >
                    <i class="pi pi-ellipsis-v"></i>
                  </button>
                </div>
              </div>

              <CallDetailsPanel
                :conversation="conversation"
                :business-id="businessId"
                :user="user"
                :expanded="messagesExpanded"
                :read-only="readOnly"
                :with-judgements="true"
                @error="recordingFailed"
              />
            </div>
          </div>
        </div>

        <div class="conversation-table-container">
          <Paginator
            :template="{
              '640px': 'PrevPageLink CurrentPageReport NextPageLink',
              '960px':
                'FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
              '1300px':
                'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink',
              default:
                'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink JumpToPageDropdown RowsPerPageDropdown',
            }"
            :alwaysShow="true"
            :rows="size"
            v-model:first="first"
            :rowsPerPageOptions="[10, 20, 30, 50, 100]"
            :totalRecords="totalHits"
            @page="onPage($event)"
          />
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-if="showProgressBar && !queryConvResultReady"
        class="conversation-table-container"
      >
        <div class="loading-skeleton">
          <div v-for="n in 3" :key="n" class="skeleton-card">
            <div class="skeleton-header">
              <div class="skeleton-text">
                <div class="skeleton-line skeleton-name"></div>
                <div class="skeleton-line skeleton-number"></div>
              </div>
            </div>
            <div class="skeleton-body">
              <div class="skeleton-line"></div>
              <div class="skeleton-line skeleton-short"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State - view-aware -->
      <div
        v-if="queryConvResultReady && totalHits === 0"
        class="conversation-table-container"
      >
        <div class="empty-state">
          <i :class="emptyStateIcon" class="empty-icon"></i>
          <p class="title">{{ emptyStateTitle }}</p>
          <p class="empty-description">{{ emptyStateDescription }}</p>
        </div>
      </div>
    </div>

    <!-- Mobile TieredMenu -->
    <TieredMenu ref="mobileMenu" :model="mobileMenuItems" popup />
    <!-- The selected calls' judgements, corrected in one gesture (StarChat decision 9, "In lists"): a bar at the
         bottom of the screen, across its whole width on a narrow one -->
    <BulkBar
      v-if="selection.size > 0"
      :label="$t('components.callInsights.feedback.bulk.label')"
      :count="selection.size"
      :narrow="selection.narrow"
    >
      <JudgementChip
        :field-label="$t('components.callInsights.feedback.bulk.changeOutcome')"
        :value-label="$t('components.callInsights.feedback.bulk.changeOutcome')"
        :name="$t('components.callInsights.feedback.bulk.changeOutcome')"
        :entries="bulkOutcomeEntries"
        :upward="true"
        :busy="bulkBusy"
        @choose="bulkResolution('wrong_value', $event.value)"
      />
      <Button type="button" size="small" outlined :label="$t('components.callInsights.feedback.bulk.spam')" :disabled="bulkBusy" @click="bulkResolution('wrong_value', 'spam_wrong_number')" />
      <Button type="button" size="small" outlined :label="$t('components.callInsights.feedback.bulk.confirm')" :disabled="bulkBusy" @click="bulkResolution('right')" />
      <Button type="button" size="small" text :label="$t('components.callInsights.feedback.bulk.clear')" @click="selection.clear()" />
    </BulkBar>
    <p v-if="bulkNote" class="bulk-note conversation-table-container" role="status">{{ bulkNote }}</p>
    <!-- The one undo of a gesture on the calls' judgements -->
    <UndoBar :raised="selection.size > 0" />
  </div>
</template>

<script>
import { computed } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import axios from "axios";
import router from "@/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase/config";
import { interval } from "rxjs";
import Tr from "@/i18n/translation";
import ConversationApi from "@/utils/Conversation";
import CallDetailsPanel from "@/components/conversations/CallDetailsPanel";
import CallInsights from "@/utils/CallInsights";
import UndoBar from "@/components/feedback/UndoBar.vue";
import Classifications from "@/utils/Classifications";
import businessUtils from "@/utils/Business";
import UndoGesture from "@/utils/UndoGesture";
import { createSelection } from "@/utils/Selection";
import JudgementChip from "@/components/feedback/JudgementChip.vue";
import BulkBar from "@/components/feedback/BulkBar.vue";
import { isSessionEnded } from "@/firebase/session";

// The search filters a link carried (a count opening its calls, brief docs/briefs/2026-10-27-classification-feedback.md
// scope 6): those with a control of their own on this page set the control; the window sets the range; the others are
// sent as they are and shown as chips. Read once, when the page opens.
const CONTROLLED = ["resolution", "message", "booked", "transferred", "hasUnanswered"];
const WINDOW = ["timestampGte", "timestampLte"];
function readAddress(query) {
  const read = Classifications.searchFromQuery(query);
  const controls = {};
  const window = {};
  const extra = {};
  for (const [key, value] of Object.entries(read.body)) {
    if (CONTROLLED.includes(key)) controls[key] = value;
    else if (WINDOW.includes(key)) window[key] = value;
    else if (key !== "counted") extra[key] = value;
  }
  const controlledKeys = ["resolution", "message", "booked", "transferred", "unanswered"];
  return {
    controls, window, extra,
    counted: read.body.counted === true,
    filters: read.filters.filter((f) => !controlledKeys.includes(f.key)),
    unknown: read.unknown,
  };
}

export default {
  components: { CallDetailsPanel, UndoBar, JudgementChip, BulkBar },
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();
    return {
      store,
      toast,
      confirm,
      user: computed(() => store.state.user),
      authIsReady: computed(() => store.state.authIsReady),
      isWebView: computed(() => store.state.isWebview),
    };
  },
  data() {
    const locale = Tr.getLocale();
    const address = readAddress(router.currentRoute.value.query);
    return {
      locale,
      periodicEvent: null,
      rangeValue: address.window.timestampGte != null
        ? [new Date(address.window.timestampGte), address.window.timestampLte != null ? new Date(address.window.timestampLte) : null]
        : null,
      businessId: null,
      timestampGte: address.window.timestampGte != null ? address.window.timestampGte : null,
      timestampLte: address.window.timestampLte != null ? address.window.timestampLte : null,
      router,
      langCode: locale,
      items: new Map(),
      totalHits: 0,
      size: 10,
      first: 0,
      showProgressBar: false,
      isAdmin: router.currentRoute.value.query.admin,
      queryConvResultReady: false,
      // the transcripts of the list, closed by default: the summary and the fields come first
      messagesExpanded: false,
      openedId: null,
      opened: null,
      openedState: null,
      activeView: "inbox",
      unreadCount: 0,
      animatingOut: new Set(),
      actionInProgress: new Set(),
      mobileMenuItems: [],
      hideRead: false,
      newestTimestamp: null,
      // What the call said (brief outcome 2): null/false means no filter. `bookedFilter` is
      // "booked" or "not_booked"; `transferredFilter` has no "not transferred" (StarChat refuses it:
      // the carrier writes only a true).
      resolutionFilter: address.controls.resolution || null,
      messageFilter: address.controls.message || null,
      bookedFilter: address.controls.booked === true ? "booked" : address.controls.booked === false ? "not_booked" : null,
      transferredFilter: address.controls.transferred === true,
      unansweredFilter: address.controls.hasUnanswered === true,
      // the business as StarChat answers it (`CallInsights.business`): its owner says whose calls these are
      business: null,
      readerKnown: false,
      // the filters a count's link carried that have no control of their own (`Classifications.searchFromQuery`)
      addressBody: address.extra,
      addressFilters: address.filters,
      addressUnknown: address.unknown,
      counted: address.counted,
      // a report count's list (`leftOut=true`): how many of its calls the reader cannot open, as StarChat counts them
      asksLeftOut: router.currentRoute.value.query.leftOut === "true",
      leftOut: 0,
      categoryLabels: null,
      // the calls selected for a gesture, by id (`createSelection`: a long-press mode on a narrow screen)
      selection: createSelection(),
      bulkBusy: false,
      bulkNote: null,
    };
  },
  computed: {
    // Whether the reader owns these calls (`Classifications.isOwnerOf`): true, false, or null while the business could not
    // be read. A known non-owner sees the read-only page; an unknown reader keeps the owner's controls (StarChat is the
    // gate for writes) but no call or judgement is read on its own, since a non-owner's read is recorded.
    ownership() {
      return Classifications.isOwnerOf(this.business, this.user);
    },
    notOwner() {
      return this.ownership === false;
    },
    readOnly() {
      return this.ownership !== true;
    },
    addressChips() {
      const chips = this.addressFilters.map((f) => ({ key: f.key, text: this.addressFilterText(f) }));
      if (this.counted) chips.push({ key: "counted", text: this.$t("components.callInsights.feedback.filters.counted") });
      return chips;
    },
    bulkOutcomeEntries() {
      return CallInsights.RESOLUTION_KEYS.map((key) => ({ key, value: key, kind: "value", label: this.$t("components.callInsights.resolution." + key) }));
    },
    resolutionOptions() {
      return CallInsights.RESOLUTION_KEYS.map((key) => ({
        label: this.$t("components.callInsights.resolution." + key),
        value: key,
      }));
    },
    messageOptions() {
      return CallInsights.MESSAGE_KEYS.map((key) => ({
        label: this.$t("components.callInsights.message." + key),
        value: key,
      }));
    },
    bookedOptions() {
      return [
        { label: this.$t("components.callInsights.booked.true"), value: "booked" },
        { label: this.$t("components.callInsights.booked.false"), value: "not_booked" },
      ];
    },
    filteredItems() {
      if (!this.hideRead) return this.items;
      const filtered = new Map();
      this.items.forEach((conv, key) => {
        if (!this.isRead(conv)) {
          filtered.set(key, conv);
        }
      });
      return filtered;
    },
    viewOptions() {
      return [
        {
          label: this.$t("components.conversations.views.inbox"),
          value: "inbox",
          icon: "pi pi-inbox",
        },
        {
          label: this.$t("components.conversations.views.archive"),
          value: "archive",
          icon: "pi pi-box",
        },
        {
          label: this.$t("components.conversations.views.trash"),
          value: "trash",
          icon: "pi pi-trash",
        },
      ];
    },
    emptyStateIcon() {
      if (this.activeView === "archive") return "pi pi-box";
      if (this.activeView === "trash") return "pi pi-trash";
      return "pi pi-inbox";
    },
    emptyStateTitle() {
      if (this.activeView === "archive")
        return this.$t("components.conversations.emptyStates.archiveEmpty");
      if (this.activeView === "trash")
        return this.$t("components.conversations.emptyStates.trashEmpty");
      return this.$t("components.conversations.emptyStates.inboxEmpty");
    },
    emptyStateDescription() {
      if (this.activeView === "archive")
        return this.$t(
          "components.conversations.emptyStates.archiveEmptyDescription"
        );
      if (this.activeView === "trash")
        return this.$t(
          "components.conversations.emptyStates.trashEmptyDescription"
        );
      return this.$t(
        "components.conversations.emptyStates.inboxEmptyDescription"
      );
    },
  },
  methods: {
    isRead(conversation) {
      if (!conversation.properties) return false;
      // Handle array format from API: [{ name, value, type }]
      if (Array.isArray(conversation.properties)) {
        const prop = conversation.properties.find(p => p.name === "MARKASREAD");
        return prop ? prop.value === "true" : false;
      }
      // Handle object format from local state update
      const prop = conversation.properties.MARKASREAD;
      if (!prop) return false;
      return prop === "true" || prop === true;
    },
    getRelativeTime(timestamp) {
      const now = Date.now();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 60000);

      if (minutes < 1) {
        return this.$t("components.conversations.justNow");
      }
      if (minutes < 60) {
        return this.$t("components.conversations.minutesAgo", {
          count: minutes,
        });
      }
      const date = new Date(timestamp);
      return date.toLocaleString(this.langCode);
    },
    getCallDuration(conversation) {
      let durationMs = null;

      if (conversation.duration) {
        durationMs = conversation.duration;
      } else if (conversation.durationSeconds) {
        durationMs = conversation.durationSeconds * 1000;
      } else if (conversation.endTimestamp && conversation.startTimestamp) {
        durationMs = conversation.endTimestamp - conversation.startTimestamp;
      } else if (conversation.end_timestamp && conversation.start_timestamp) {
        durationMs = conversation.end_timestamp - conversation.start_timestamp;
      }

      if (!durationMs || durationMs <= 0) return null;

      const totalSeconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return this.$t("components.conversations.duration", { minutes, seconds });
    },
    // The reader's role (the same business search that sets it on the analytics pages) and the business's owner, to
    // tell an owner's page from a non-owner's. Unknown (a failed read) is read-only: the safe side of a recorded read.
    async establishReader() {
      const user = this.store.state.user;
      if (!user || !user.accessToken) return;
      try {
        await businessUtils.checkUserHasBusinesses(user, this.store);
      } catch (error) {
        console.debug("Role not read:", error && error.response ? error.response.status : "");
      }
      await this.readBusiness();
      this.readerKnown = true;
      if (this.addressFilters.some((f) => f.key === "category")) {
        Classifications.categories(user, this.$i18n.locale)
          .then((answer) => { this.categoryLabels = answer && Array.isArray(answer.items) ? answer.items : null; })
          .catch(() => { this.categoryLabels = null; });
      }
    },
    addressFilterText(f) {
      const t = (k, v) => this.$t("components.callInsights.feedback.filters.chip", { name: this.$t("components.callInsights.feedback.filters.names." + k), value: v });
      const v = f.value;
      switch (f.key) {
        case "outcomeLine": return t(f.key, this.$t("components.callInsights.outcome." + (v.startsWith("forwarded_") ? "forwarded" : v)) +
          (v.startsWith("forwarded_") ? " " + this.$t("components.callInsights.outcome." + v) : ""));
        case "noConversation": return t(f.key, this.$t("components.callInsights.noConversation.reasons." + v));
        case "gap": return t(f.key, this.$t("components.callInsights.gaps." + v));
        case "check": return t(f.key, this.$t("components.callInsights.checks." + v));
        case "requestOutcome": return t(f.key, v.map((o) => this.$t("components.callInsights.feedback.outcome." + o)).join(", "));
        case "corrected": return t(f.key, this.$t("components.callInsights.feedback.filters." + (v ? "yes" : "no")));
        case "topicLabel": return t("topic", v.join(", "));
        case "category": {
          if (v === Classifications.UNCLASSIFIED) return t(f.key, this.$t("components.callInsights.feedback.unset"));
          const c = (this.categoryLabels || []).find((x) => x.key === v);
          return c ? t(f.key, c.label) : this.$t("components.callInsights.feedback.filters.names.category");
        }
        default: return t(f.key, String(v));
      }
    },
    removeAddressFilter(key) {
      if (key === "counted") this.counted = false;
      const f = Classifications.ADDRESS_FILTERS.find((x) => x.key === key);
      this.addressFilters = this.addressFilters.filter((x) => x.key !== key);
      const body = { ...this.addressBody };
      if (f) delete body[f.body];
      this.addressBody = body;
      this.router.replace({ path: this.$route.path, query: Classifications.withoutFilter(this.$route.query, key) });
      this.resetAndReload();
    },
    selectRow(key, on) {
      this.selection.toggle(key, on);
      this.bulkNote = null;
    },
    // One gesture over the selected calls' resolution (`POST insights/feedback/bulk`, all or nothing, one undo): a new
    // value, or "right". A call without a judged resolution, or already at the value asked, is left out, and said.
    async bulkResolution(signal, valueTo) {
      const asks = [];
      let leftOut = 0;
      for (const key of this.selection.selected) {
        const conversation = this.items.get(key);
        const current = conversation && conversation.details ? conversation.details.resolution : null;
        if (!current) { leftOut += 1; continue; }
        if (signal === "wrong_value" && current === valueTo) continue;
        asks.push(Classifications.ask({ conversationId: key, field: "resolution", signal, valueFrom: current, valueTo }));
      }
      this.bulkNote = leftOut > 0 ? this.$t("components.callInsights.feedback.bulk.leftOut", { n: leftOut }, leftOut) : null;
      if (asks.length === 0) return;
      const gestureId = Classifications.newGestureId();
      this.bulkBusy = true;
      try {
        await Classifications.bulk(this.user, asks, gestureId);
        UndoGesture.record(gestureId, asks.map((a) => a.conversationId), () => this.conversationList());
        this.selection.clear();
      } catch (error) {
        if (isSessionEnded(error)) return;
        const refusal = CallInsights.refusalOf(error);
        this.bulkNote = this.$t(refusal && refusal.code === "stale_value"
          ? "components.callInsights.feedback.stale"
          : "components.callInsights.feedback.failed");
      } finally {
        this.bulkBusy = false;
      }
      this.conversationList();
    },
    openFromList(key) {
      this.router.replace({ path: this.$route.path, query: { ...this.$route.query, conversation: key } });
      this.openConversation(key);
      window.scrollTo(0, 0);
    },
    async readBusiness() {
      const user = this.store.state.user;
      if (!user || !this.businessId) return;
      try {
        this.business = await CallInsights.business(user, this.businessId);
      } catch (error) {
        console.debug("Business not read:", error && error.response ? error.response.status : "");
        this.business = null;
      }
    },
    callerName(conversation) {
      const details = conversation.details || {};
      return details.callerName || conversation.contactName ||
        this.$t("components.conversations.unknownContact");
    },
    async openConversation(id) {
      this.openedId = id;
      this.openedState = "loading";
      try {
        this.opened = await ConversationApi.get(this.user, this.businessId, id);
        this.openedState = this.opened ? "found" : "missing";
      } catch (error) {
        console.error("Conversation not opened:", id, error.response ? error.response.status : "");
        this.openedState = "missing";
      }
    },
    closeOpened() {
      this.openedId = null;
      this.opened = null;
      this.openedState = null;
      const query = { ...this.$route.query };
      delete query.conversation;
      this.router.replace({ path: this.$route.path, query });
    },
    recordingFailed() {
      this.toast.add({
        severity: "error",
        summary: this.$t("components.conversations.toast.actionFailed"),
        life: 5000,
      });
    },
    clearDateFilter() {
      this.rangeValue = null;
    },
    dateToTimestamp(d) {
      return Date.parse(d);
    },
    timestampToDate(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString(this.langCode);
    },
    getViewFilters() {
      if (this.activeView === "archive") {
        return { archived: true, deleted: false };
      }
      if (this.activeView === "trash") {
        return { deleted: true };
      }
      // inbox
      return { archived: false, deleted: false };
    },
    // The one body the list, its poll, both exports and the two bulk actions build from: the
    // view, the date range and what the call said (resolution, message, booked, transferred,
    // unanswered questions), so an export or
    // a bulk action always acts on exactly the calls the list shows. `extra` carries what is
    // specific to one caller (pagination, `lightweight`, the poll's own `timestampGte`), applied
    // after the shared fields so it can override them.
    searchBody(extra = {}) {
      // A count's list is the calls the statistics count, archived ones included (StarChat's `counted`: finalised and
      // not deleted); the inbox's narrowing to calls not archived would make it shorter than its count.
      const body = {
        businessId: this.businessId,
        ...(this.counted ? {} : this.getViewFilters()),
      };
      if (this.timestampGte != null) body.timestampGte = this.timestampGte;
      if (this.timestampLte != null) body.timestampLte = this.timestampLte;
      if (this.resolutionFilter) body.resolution = this.resolutionFilter;
      if (this.messageFilter) body.message = this.messageFilter;
      if (this.bookedFilter) body.booked = this.bookedFilter === "booked";
      if (this.transferredFilter) body.transferred = true;
      if (this.unansweredFilter) body.hasUnanswered = true;
      if (this.counted) body.counted = true;
      Object.assign(body, this.addressBody);
      return { ...body, ...extra };
    },
    // A changed view or filter invalidates the page shown: start over from the first one, as
    // (before this) only a changed view already did.
    resetAndReload() {
      this.selection.clear();
      this.first = 0;
      this.items = new Map();
      this.totalHits = 0;
      this.newestTimestamp = null;
      this.conversationList();
    },
    downloadItemsTsv() {
      if (!this.user || !this.user.accessToken) return;
      const self = this;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        auth: this.user.accessToken,
      };
      const request = this.searchBody({ lightweight: true });
      console.debug(request);
      self.showProgressBar = true;
      axios
        .post(
          process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/customer/conversation/stream/tsv/formatTsvV1",
          request,
          {
            headers: headers,
            responseType: "blob",
          }
        )
        .then((response) => {
          const blob = new Blob([response.data], { type: response.data.type });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `conversations.${Date.now()}.tsv`;
          link.click();
          URL.revokeObjectURL(link.href);
          self.showProgressBar = false;
        })
        .catch((error) => {
          console.error(error);
          self.showProgressBar = false;
        });
    },
    downloadItemsJson() {
      if (!this.user || !this.user.accessToken) return;
      const self = this;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        auth: this.user.accessToken,
      };
      const request = this.searchBody({ lightweight: true });
      console.debug(request);
      self.showProgressBar = true;
      axios
        .post(
          process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/customer/conversation/stream/json/jsonV1",
          request,
          {
            headers: headers,
            responseType: "blob",
          }
        )
        .then((response) => {
          const blob = new Blob([response.data], { type: response.data.type });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `conversations.${Date.now()}.stream.json`;
          link.click();
          URL.revokeObjectURL(link.href);
          self.showProgressBar = false;
        })
        .catch((error) => {
          console.error(error);
          self.showProgressBar = false;
        });
    },
    async conversationList() {
      if (!this.user || !this.user.accessToken) {
        console.debug("User not ready, skipping conversationList");
        return;
      }
      if (this.animatingOut.size > 0) return;
      const self = this;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        auth: this.user.accessToken,
      };
      // the recordings stay out of the list: CallDetailsPanel reads one when it is played
      const request = self.searchBody({ lightweight: true, from: self.first, size: self.size });
      const leftOutQuery = self.asksLeftOut ? "&leftOut=true" : "";
      self.showProgressBar = true;
      axios
        .post(
          process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/customer/conversation/search?enableDataMap=true" + leftOutQuery,
          request,
          {
            headers: headers,
          }
        )
        .then((response) => {
          self.queryConvResultReady = true;
          self.leftOut = response.data && typeof response.data.leftOut === "number" ? response.data.leftOut : 0;
          const map = new Map();
          let unread = 0;
          let newest = null;
          if (
            response.data &&
            response.data.hits &&
            response.data.hits.length > 0
          ) {
            response.data.hits.forEach(function (item) {
              map.set(item.document.id, item.document);
              if (!self.isRead(item.document)) {
                unread++;
              }
              if (item.document.startTimestamp && (newest === null || item.document.startTimestamp > newest)) {
                newest = item.document.startTimestamp;
              }
            });
            self.totalHits = response.data.totalHits;
            console.debug("totalHits:", response.data.totalHits);
          } else {
            self.totalHits = 0;
            self.newestTimestamp = null;
            self.showProgressBar = false;
          }
          self.items = map;
          self.newestTimestamp = newest;
          // a selected call no longer listed is no longer selected
          for (const key of self.selection.selected) if (!map.has(key)) self.selection.toggle(key, false);
          if (self.activeView === "inbox") {
            self.unreadCount = unread;
          }
          self.showProgressBar = false;
        })
        .catch((error) => {
          console.error(error);
          self.queryConvResultReady = true;
          self.showProgressBar = false;
        });
    },
    pollForNewConversations() {
      if (this.first !== 0) return;
      if (!this.user || !this.user.accessToken) return;
      if (this.animatingOut.size > 0) return;
      if (this.newestTimestamp === null) {
        this.conversationList();
        return;
      }
      const self = this;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        auth: this.user.accessToken,
      };
      // the recordings stay out of the list: CallDetailsPanel reads one when it is played
      const request = self.searchBody({
        lightweight: true,
        from: 0,
        size: self.size,
        timestampGte: self.newestTimestamp + 1,
      });
      self.showProgressBar = true;
      axios
        .post(
          process.env.VUE_APP_STARCHAT_URL +
            "/mrcall/v1/mrcall0/customer/conversation/search?enableDataMap=true",
          request,
          { headers: headers }
        )
        .then((response) => {
          if (
            response.data &&
            response.data.hits &&
            response.data.hits.length > 0
          ) {
            const newMap = new Map();
            let newest = self.newestTimestamp;
            response.data.hits.forEach(function (item) {
              newMap.set(item.document.id, item.document);
              if (item.document.startTimestamp && item.document.startTimestamp > newest) {
                newest = item.document.startTimestamp;
              }
            });
            // Prepend new items before existing ones
            self.items.forEach((val, key) => {
              if (!newMap.has(key)) {
                newMap.set(key, val);
              }
            });
            self.items = newMap;
            self.newestTimestamp = newest;
            self.totalHits = self.totalHits + response.data.hits.length;
            // Recalculate unread count
            if (self.activeView === "inbox") {
              let unread = 0;
              self.items.forEach((conv) => {
                if (!self.isRead(conv)) unread++;
              });
              self.unreadCount = unread;
            }
          }
          self.showProgressBar = false;
        })
        .catch((error) => {
          console.debug("Poll error:", error);
          self.showProgressBar = false;
        });
    },
    onPage(event) {
      this.selection.clear();
      this.first = event.first;
      this.size = event.rows;
      this.conversationList();
    },
    animateOutAndRemove(key) {
      return new Promise((resolve) => {
        this.animatingOut.add(key);
        this.animatingOut = new Set(this.animatingOut);
        setTimeout(() => {
          this.items.delete(key);
          this.items = new Map(this.items);
          this.selection.toggle(key, false);
          this.totalHits = Math.max(0, this.totalHits - 1);
          this.animatingOut.delete(key);
          this.animatingOut = new Set(this.animatingOut);
          resolve();
        }, 300);
      });
    },
    async archiveConversation(key) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      try {
        await ConversationApi.archive(this.user, key);
        this.animateOutAndRemove(key);
        this.toast.add({
          severity: "success",
          summary: this.$t("components.conversations.toast.conversationArchived"),
          detail: this.$t("components.conversations.toast.undo"),
          life: 5000,
          group: "undo",
          data: { action: "unarchive", id: key },
        });
      } catch (error) {
        console.error("Archive failed:", error);
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    async unarchiveConversation(key) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      try {
        await ConversationApi.unarchive(this.user, key);
        this.animateOutAndRemove(key);
        this.toast.add({
          severity: "success",
          summary: this.$t("components.conversations.toast.conversationUnarchived"),
          life: 5000,
        });
      } catch (error) {
        console.error("Unarchive failed:", error);
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    async deleteConversation(key) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      try {
        await ConversationApi.softDelete(this.user, key);
        this.animateOutAndRemove(key);
        this.toast.add({
          severity: "warn",
          summary: this.$t("components.conversations.toast.conversationDeleted"),
          detail: this.$t("components.conversations.toast.undo"),
          life: 5000,
          group: "undo",
          data: { action: "undelete", id: key },
        });
      } catch (error) {
        console.error("Delete failed:", error);
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    async restoreConversation(key) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      try {
        await ConversationApi.undelete(this.user, key);
        this.animateOutAndRemove(key);
        this.toast.add({
          severity: "success",
          summary: this.$t("components.conversations.toast.conversationRestored"),
          life: 5000,
        });
      } catch (error) {
        console.error("Restore failed:", error);
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    async toggleReadStatus(key, conversation) {
      if (this.actionInProgress.has(key)) return;
      this.actionInProgress.add(key);
      this.actionInProgress = new Set(this.actionInProgress);

      const wasRead = this.isRead(conversation);
      try {
        if (wasRead) {
          await ConversationApi.markAsUnread(this.user, key);
        } else {
          await ConversationApi.markAsRead(this.user, key);
        }
        // Update local state
        const newValue = wasRead ? "false" : "true";
        if (!conversation.properties) {
          conversation.properties = {};
        }
        if (Array.isArray(conversation.properties)) {
          const idx = conversation.properties.findIndex(p => p.name === "MARKASREAD");
          if (idx >= 0) {
            conversation.properties[idx].value = newValue;
          } else {
            conversation.properties.push({ name: "MARKASREAD", value: newValue, type: "boolean" });
          }
        } else {
          conversation.properties.MARKASREAD = newValue;
        }
        // Recalculate unread count
        let unread = 0;
        this.items.forEach((conv) => {
          if (!this.isRead(conv)) unread++;
        });
        this.unreadCount = unread;
        // Force reactivity
        this.items = new Map(this.items);
      } catch (error) {
        console.error("Toggle read failed:", key, error.response ? error.response.status : "");
        this.toast.add({
          severity: "error",
          summary: this.$t("components.conversations.toast.actionFailed"),
          life: 5000,
        });
      } finally {
        this.actionInProgress.delete(key);
        this.actionInProgress = new Set(this.actionInProgress);
      }
    },
    openMobileMenu(event, key, conversation) {
      const items = [];
      if (this.activeView === "inbox") {
        items.push({
          label: this.isRead(conversation)
            ? this.$t("components.conversations.actions.markAsUnread")
            : this.$t("components.conversations.actions.markAsRead"),
          icon: this.isRead(conversation) ? "pi pi-check-square" : "pi pi-check",
          command: () => this.toggleReadStatus(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.archive"),
          icon: "pi pi-box",
          command: () => this.archiveConversation(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.delete"),
          icon: "pi pi-trash",
          command: () => this.deleteConversation(key, conversation),
        });
      } else if (this.activeView === "archive") {
        items.push({
          label: this.isRead(conversation)
            ? this.$t("components.conversations.actions.markAsUnread")
            : this.$t("components.conversations.actions.markAsRead"),
          icon: this.isRead(conversation) ? "pi pi-check-square" : "pi pi-check",
          command: () => this.toggleReadStatus(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.unarchive"),
          icon: "pi pi-inbox",
          command: () => this.unarchiveConversation(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.delete"),
          icon: "pi pi-trash",
          command: () => this.deleteConversation(key, conversation),
        });
      } else if (this.activeView === "trash") {
        items.push({
          label: this.isRead(conversation)
            ? this.$t("components.conversations.actions.markAsUnread")
            : this.$t("components.conversations.actions.markAsRead"),
          icon: this.isRead(conversation) ? "pi pi-check-square" : "pi pi-check",
          command: () => this.toggleReadStatus(key, conversation),
        });
        items.push({
          label: this.$t("components.conversations.actions.restore"),
          icon: "pi pi-undo",
          command: () => this.restoreConversation(key, conversation),
        });
      }
      this.mobileMenuItems = items;
      this.$nextTick(() => {
        this.$refs.mobileMenu.toggle(event);
      });
    },
    buildSearchFilter() {
      return this.searchBody();
    },
    bulkArchiveAll() {
      this.confirm.require({
        message: this.$t("components.conversations.confirmBulk.archiveMessage"),
        header: this.$t("components.conversations.confirmBulk.title"),
        icon: "pi pi-exclamation-triangle",
        defaultFocus: "reject",
        accept: async () => {
          try {
            this.showProgressBar = true;
            const response = await ConversationApi.bulkArchive(this.user, this.buildSearchFilter());
            const count = response.data && response.data.count != null ? response.data.count : "";
            this.toast.add({
              severity: "success",
              summary: this.$t("components.conversations.toast.bulkArchived"),
              detail: count ? String(count) : "",
              life: 5000,
            });
            this.first = 0;
            this.conversationList();
          } catch (error) {
            console.error("Bulk archive failed:", error);
            this.toast.add({
              severity: "error",
              summary: this.$t("components.conversations.toast.actionFailed"),
              life: 5000,
            });
          } finally {
            this.showProgressBar = false;
          }
        },
      });
    },
    bulkDeleteAll() {
      this.confirm.require({
        message: this.$t("components.conversations.confirmBulk.deleteMessage"),
        header: this.$t("components.conversations.confirmBulk.title"),
        icon: "pi pi-exclamation-triangle",
        defaultFocus: "reject",
        accept: async () => {
          try {
            this.showProgressBar = true;
            const response = await ConversationApi.bulkDelete(this.user, this.buildSearchFilter());
            const count = response.data && response.data.count != null ? response.data.count : "";
            this.toast.add({
              severity: "warn",
              summary: this.$t("components.conversations.toast.bulkDeleted"),
              detail: count ? String(count) : "",
              life: 5000,
            });
            this.first = 0;
            this.conversationList();
          } catch (error) {
            console.error("Bulk delete failed:", error);
            this.toast.add({
              severity: "error",
              summary: this.$t("components.conversations.toast.actionFailed"),
              life: 5000,
            });
          } finally {
            this.showProgressBar = false;
          }
        },
      });
    },
    bulkUnarchiveAll() {
      this.confirm.require({
        message: this.$t("components.conversations.confirmBulk.unarchiveMessage"),
        header: this.$t("components.conversations.confirmBulk.title"),
        icon: "pi pi-exclamation-triangle",
        defaultFocus: "reject",
        accept: async () => {
          try {
            this.showProgressBar = true;
            const response = await ConversationApi.bulkUnarchive(this.user, this.buildSearchFilter());
            const count = response.data && response.data.count != null ? response.data.count : "";
            this.toast.add({
              severity: "success",
              summary: this.$t("components.conversations.toast.bulkUnarchived"),
              detail: count ? String(count) : "",
              life: 5000,
            });
            this.first = 0;
            this.conversationList();
          } catch (error) {
            console.error("Bulk unarchive failed:", error);
            this.toast.add({
              severity: "error",
              summary: this.$t("components.conversations.toast.actionFailed"),
              life: 5000,
            });
          } finally {
            this.showProgressBar = false;
          }
        },
      });
    },
    bulkRestoreAll() {
      this.confirm.require({
        message: this.$t("components.conversations.confirmBulk.restoreMessage"),
        header: this.$t("components.conversations.confirmBulk.title"),
        icon: "pi pi-exclamation-triangle",
        defaultFocus: "reject",
        accept: async () => {
          try {
            this.showProgressBar = true;
            const response = await ConversationApi.bulkUndelete(this.user, this.buildSearchFilter());
            const count = response.data && response.data.count != null ? response.data.count : "";
            this.toast.add({
              severity: "success",
              summary: this.$t("components.conversations.toast.bulkRestored"),
              detail: count ? String(count) : "",
              life: 5000,
            });
            this.first = 0;
            this.conversationList();
          } catch (error) {
            console.error("Bulk restore failed:", error);
            this.toast.add({
              severity: "error",
              summary: this.$t("components.conversations.toast.actionFailed"),
              life: 5000,
            });
          } finally {
            this.showProgressBar = false;
          }
        },
      });
    },
  },
  watch: {
    activeView() {
      this.resetAndReload();
    },
    resolutionFilter() {
      this.resetAndReload();
    },
    messageFilter() {
      this.resetAndReload();
    },
    bookedFilter() {
      this.resetAndReload();
    },
    transferredFilter() {
      this.resetAndReload();
    },
    unansweredFilter() {
      this.resetAndReload();
    },
    rangeValue: function (value) {
      if (!this.user || !this.user.accessToken) return;
      this.first = 0;
      if (value === null) {
        this.timestampLte = null;
        this.timestampGte = null;
        this.conversationList();
      } else if (value[0] !== null && value[1] !== null) {
        console.debug("value[0] !== null and value[1] !== null", value);
        this.timestampGte = this.dateToTimestamp(value[0]);
        this.timestampLte = this.dateToTimestamp(value[1]);
        this.conversationList();
      } else if (value[0] !== null) {
        console.debug("value[0] !== null", value);
        this.timestampGte = this.dateToTimestamp(value[0]);
        this.conversationList();
      } else {
        console.error("null", value);
      }
    },
  },
  beforeUnmount() {
    this.selection.dispose();
    console.debug("Before Unmount");
    if (this.periodicEvent) {
      this.periodicEvent.unsubscribe();
    }
  },
  mounted() {
    this.businessId = this.$route.query.id;
    if (this.$route.query.lang) {
      this.langCode = this.$route.query.lang.replace("_", "-");
    }
    if (!this.store || !this.store.state) {
      console.debug("Store not ready");
      return;
    }
    // The reader's role and whether it owns the business's calls, known before anything is read: a non-owner's read of
    // a call by id is recorded by StarChat, and its page shows no owner-only control (brief
    // docs/briefs/2026-10-27-classification-feedback.md, scope 11).
    const proceed = async () => {
      await this.establishReader();
      if (this.$route.query.conversation) this.openConversation(this.$route.query.conversation);
      this.conversationList();
      this.periodicEvent = interval(10000).subscribe(() => {
        this.pollForNewConversations();
      });
    };
    if (!this.store.state.user) {
      onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          console.debug("UserStateChanged:", user);
          proceed();
        }
      });
    } else if (this.store.state.user.accessToken) {
      proceed();
    }
  },
};
</script>

<style lang="less" scoped>
@import "../assets/style/colors";
@import "../assets/style/fonts";

.conversation-table-container {
  margin: auto;
  max-width: 700px;
  padding: 0 16px;

  @media screen and (max-width: 640px) {
    max-width: 100%;
    padding: 0 12px;
  }
}

// View Switcher
.view-switcher {
  margin-bottom: 16px;
  padding-top: 8px;

  :deep(.p-selectbutton) {
    width: 100%;
    display: flex;
  }

  :deep(.p-selectbutton .p-button) {
    flex: 1;
    justify-content: center;
  }
}

.view-option {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;

  i {
    font-size: 14px;
  }
}

.unread-badge {
  background: @mrcall_blue;
  color: @mrcall_white;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  line-height: 1.4;
}

// Filters Card
.filters-card {
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  margin-bottom: 20px;
  overflow: hidden;
}

.filters-header {
  background: @mrcall_light_grey_2;
  padding: 12px 16px;
  border-bottom: 1px solid @mrcall_borders;
}

.filters-title {
  font-weight: 600;
  font-size: 14px;
  color: @mrcall_dark_grey_text;
}

.filters-content {
  padding: 16px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid @mrcall_light_grey_2;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }

  @media screen and (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

.insight-assessed-tag {
  font-size: 10px;
  font-weight: 600;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
  font-size: 14px;
  color: @mrcall_grey_text;
  font-weight: 500;

  i {
    font-size: 14px;
    color: @mrcall_grey_text2;
  }

  @media screen and (max-width: 640px) {
    min-width: auto;
  }
}

.filter-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;

  @media screen and (max-width: 640px) {
    width: 100%;
  }
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: @mrcall_light_grey_2;
  border-radius: 50%;
  cursor: pointer;
  color: @mrcall_grey_text;
  transition: all 0.2s ease;

  &:hover {
    background: @mrcall_light_grey_1;
    color: @mrcall_dark_grey_text;
  }

  i {
    font-size: 12px;
  }
}

.export-buttons {
  display: flex;
  gap: 8px;

  @media screen and (max-width: 640px) {
    width: 100%;

    :deep(.p-button) {
      flex: 1;
    }
  }
}

.toggle-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-label {
  font-size: 14px;
  color: @mrcall_grey_text;
}

// Conversation Cards
.conversations-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 16px 0;
}

.conversation-card {
  background: @mrcall_white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid @mrcall_borders;
  transition: box-shadow 0.2s ease, opacity 0.3s ease, max-height 0.3s ease, padding 0.3s ease, margin 0.3s ease;
  border-left: 4px solid @mrcall_light_grey_1;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  &.unread {
    border-left: 4px solid @mrcall_blue;

    .contact-name {
      font-weight: 700;
    }

    .timestamp-unread {
      color: @mrcall_blue;
      font-weight: 700;
    }
  }

  &.animating-out {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    margin-top: 0;
    margin-bottom: 0;
    overflow: hidden;
    border-width: 0;
  }

  @media screen and (max-width: 640px) {
    padding: 12px;
    border-radius: 10px;
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.contact-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.contact-name {
  font-weight: 600;
  font-size: 16px;
  color: @mrcall_black;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: @mrcall_blue;
  flex-shrink: 0;
}

.contact-number {
  font-size: 14px;
  color: @mrcall_grey_text;
}

.timestamp-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.timestamp {
  font-size: 13px;
  color: @mrcall_grey_text2;
  white-space: nowrap;
}

.duration {
  font-size: 12px;
  color: @mrcall_grey_text;
  white-space: nowrap;
}

// Card Actions
.desktop-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  @media screen and (max-width: 640px) {
    display: none;
  }
}

.mobile-action-trigger {
  display: none;
  flex-shrink: 0;

  @media screen and (max-width: 640px) {
    display: flex;
  }
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: @mrcall_grey_text;
  transition: all 0.15s ease;

  &:hover {
    background: @mrcall_light_grey_2;
    color: @mrcall_dark_grey_text;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  i {
    font-size: 14px;
  }
}

.action-btn-danger {
  &:hover {
    background: #fef2f2;
    color: #dc2626;
  }
}

.btn-delete-all {
  &:deep(.p-button) {
    background: @mrcall_orange;
    border-color: @mrcall_orange;
    color: @mrcall_black;
  }
}

:deep(.btn-delete-all) {
  background: @mrcall_orange !important;
  border-color: @mrcall_orange !important;
  color: @mrcall_black !important;

  &:hover {
    background: darken(@mrcall_orange, 10%) !important;
    border-color: darken(@mrcall_orange, 10%) !important;
  }
}

.action-btn-read {
  color: @mrcall_black;
  flex-shrink: 0;

  &:hover {
    background: @mrcall_light_grey_2;
    color: @mrcall_dark_grey_text;
  }
}

.opened-card {
  margin: 16px 0;
  border-left: 4px solid @mrcall_blue;
}

.opened-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: @mrcall_blue;
  margin-bottom: 8px;
}

.opened-state {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 10px;
  background: @mrcall_light_grey_2;
  color: @mrcall_dark_grey_text;
  letter-spacing: normal;
  text-transform: none;
  font-weight: 600;
}

.opened-missing {
  margin: 0;
  font-size: 14px;
  color: @mrcall_grey_text;
}

// Empty State
.empty-state {
  text-align: center;
  padding: 60px 20px;

  .empty-icon {
    font-size: 48px;
    color: @mrcall_light_grey_1;
    margin-bottom: 16px;
  }

  .title {
    font-size: 18px;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
    margin-bottom: 8px;
  }

  .empty-description {
    font-size: 14px;
    color: @mrcall_grey_text;
    max-width: 300px;
    margin: 0 auto;
  }
}

// Loading Skeleton
.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 16px 0;
}

.skeleton-card {
  background: @mrcall_white;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid @mrcall_borders;
}

.skeleton-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.skeleton-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  background: @mrcall_light_grey_2;
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-name {
  width: 120px;
  height: 18px;
}

.skeleton-number {
  width: 100px;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-short {
  width: 70%;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.read-only-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 0;
  padding: 10px 12px;
  border: 1px solid @mrcall_borders;
  border-radius: 10px;
  background: @mrcall_light_grey_2;
  font-size: 14px;
  color: @mrcall_dark_grey_text;
}

.read-only-note {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: @mrcall_grey_text;
}

.address-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}

.address-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 10px;
  border: 1px solid @mrcall_blue;
  border-radius: 16px;
  font-size: 13px;
  color: @mrcall_blue;
  background: @mrcall_white;
}

.address-chip-clear {
  border: none;
  background: none;
  color: @mrcall_blue;
  cursor: pointer;
  min-width: 28px;
  min-height: 28px;
  border-radius: 14px;

  &:focus-visible {
    outline: 2px solid @mrcall_blue;
  }
}

.address-unknown {
  margin: 0;
  font-size: 13px;
  color: @mrcall_grey_text;
}

.select-check {
  width: 20px;
  height: 20px;
  margin: 0 8px 0 0;
  flex: none;
  accent-color: @mrcall_blue;
}

.selected-card {
  outline: 2px solid @mrcall_blue;
}

.open-call-btn {
  flex: none;
}




.bulk-note {
  font-size: 13px;
  color: @mrcall_grey_text;
}
</style>
