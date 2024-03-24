var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Global settings
var superpower_settings;
(function (superpower_settings) {
    superpower_settings.increase_zoom_levels = true;
    superpower_settings.increase_zoom_levels_count = 128;
    superpower_settings.spectrum_fluidity = true;
    superpower_settings.spectrum_fluidity_refresh_time = 30; // in ms
    superpower_settings.spectrum_enlarge = true;
    superpower_settings.spectrum_enlarge_height = '200px';
    superpower_settings.frequency_change = true;
    superpower_settings.gain_change = true;
    // Experimental
    superpower_settings.waterfall_refreshing = false;
    superpower_settings.profile_memory = false;
})(superpower_settings || (superpower_settings = {}));
$.fn.onClassChange = function (callback) {
    return $(this).each(({}, element) => {
        new MutationObserver(mutations => {
            mutations.forEach((mutation) => {
                callback($(mutation.target), mutation.target.className);
            });
        }).observe(element, {
            attributes: true,
            attributeFilter: ['class']
        });
    });
};
$.fn.onResize = function (callback) {
    return $(this).each(({}, element) => {
        new ResizeObserver((entries) => {
            entries.forEach((entry) => {
                callback($(entry.target));
            });
        }).observe(element);
    });
};
// Utilities
function waitFor(predicate, callback, delay = 100) {
    const timer = setInterval(() => {
        if (predicate()) {
            clearInterval(timer);
            callback();
        }
    }, delay);
}
function debounce(threshold, callback) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            callback(...args);
        }, threshold);
    };
}
function isProfileUnlocked(sdr_profile) {
    return sdr_profile.name.toLowerCase().startsWith('unlocked');
}
function getSelectedProfile() {
    var _a;
    const value = (_a = $('#openwebrx-sdr-profiles-listbox')) === null || _a === void 0 ? void 0 : _a.val();
    const desc = value === null || value === void 0 ? void 0 : value.split('|');
    if (desc === undefined || desc[0] === undefined || desc[1] === undefined) {
        return undefined;
    }
    return {
        device: desc[0],
        name: desc[1],
    };
}
function readSettings(sdr_profile) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isProfileUnlocked(sdr_profile)) {
            return undefined;
        }
        try {
            const doc = yield $.ajax({
                url: `settings/sdr/${sdr_profile.device}/profile/${sdr_profile.name}`,
                type: 'GET',
                xhrFields: {
                    withCredentials: true
                },
            });
            return $(doc).find('form.settings-body').serializeArray();
        }
        catch (_err) {
            return undefined;
        }
    });
}
function writeSettings(sdr_profile, settings) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isProfileUnlocked(sdr_profile)) {
            return undefined;
        }
        const current_settings = yield readSettings(sdr_profile);
        if (current_settings === undefined) {
            return undefined;
        }
        const combine_settings = (existing_settings, settings) => {
            return existing_settings.map((existing_setting) => {
                const setting = settings.find((setting) => existing_setting.name == setting.name);
                if (setting !== undefined) {
                    return setting;
                }
                return existing_setting;
            });
        };
        // Preserve existing settings
        const data = combine_settings(current_settings, settings);
        // Save data to profile "Unlocked" with POST query
        try {
            yield $.ajax({
                url: `settings/sdr/${sdr_profile.device}/profile/${sdr_profile.name}`,
                type: 'POST',
                data: $.param(data),
                xhrFields: {
                    withCredentials: true
                },
            });
            return yield readSettings(sdr_profile);
        }
        catch (_err) {
            return undefined;
        }
    });
}
function getSettingValueByName(settings, name) {
    const setting = settings.find((setting) => setting.name == name);
    return setting === null || setting === void 0 ? void 0 : setting.value;
}
function getSdrFreqRange(sdr_profile) {
    const sdr_freq_range = {
        'airspy': { min: { exp: 0, value: 1 }, max: { exp: 9, value: 1.8 } },
        'rtlsdr': { min: { exp: 0, value: 1 }, max: { exp: 9, value: 2.2 } },
        'sdrplay': { min: { exp: 0, value: 1 }, max: { exp: 9, value: 2.0 } },
    };
    return sdr_freq_range[sdr_profile.device];
}
function rangeMidpoint(range) {
    return Math.floor((range.max.value - range.min.value) / 2);
}
function getSdrGainRange(sdr_profile) {
    const sdr_gain_range = {
        'airspy': { min: { value: 0.0 }, max: { value: 45.0 }, step: 0.1, reversed: false },
        'rtlsdr': { min: { value: 0.0 }, max: { value: 49.6 }, step: 0.1, reversed: false },
        'sdrplay': { min: { value: 20.0 }, max: { value: 59.0 }, step: 1.0, reversed: true },
    };
    return sdr_gain_range[sdr_profile.device];
}
function getSdrSecondaryGainRange(sdr_profile) {
    const sdr_secondary_gain_range = {
        'sdrplay': { min: { value: 0.0 }, max: { value: 3.0 }, step: 1.0, reversed: true },
    };
    return sdr_secondary_gain_range[sdr_profile.device];
}
function isGainInRange(gain_range, gain) {
    return gain.value >= gain_range.min.value && gain.value <= gain_range.max.value;
}
function clampGainToRange(range, gain) {
    return { value: Math.min(Math.max(gain.value, range.min.value), range.max.value) };
}
function isFreqInRange(freq_range, freq) {
    const freq_value = freqIntoNumber(freq);
    return freq_value >= freqIntoNumber(freq_range.min) && freq_value <= freqIntoNumber(freq_range.max);
}
function clampFreqToRange(range, freq) {
    return { exp: 0, value: Math.min(Math.max(freqIntoNumber(freq), freqIntoNumber(range.min)), freqIntoNumber(range.max)) };
}
function freqIntoNumber(freq) {
    return freq.value * Math.pow(10, freq.exp);
}
function setFrequency(jump_freq) {
    return __awaiter(this, void 0, void 0, function* () {
        const sdr_profile = getSelectedProfile();
        if (sdr_profile === undefined) {
            return undefined;
        }
        const freq_range = getSdrFreqRange(sdr_profile);
        if (freq_range === undefined) {
            return undefined;
        }
        const freq_decoded = (() => {
            if (jump_freq.type == 'value') {
                if (Number.isNaN(jump_freq.exp) || Number.isNaN(jump_freq.value)) {
                    return undefined;
                }
                return jump_freq;
            }
            const visible_freq_range = get_visible_freq_range();
            const freq_width = visible_freq_range.end - visible_freq_range.start;
            switch (jump_freq.type) {
                case 'prev': return { exp: 0, value: visible_freq_range.center - freq_width };
                case 'next': return { exp: 0, value: visible_freq_range.center + freq_width };
            }
        })();
        if (freq_decoded === undefined) {
            return undefined;
        }
        const freq_new = clampFreqToRange(freq_range, freq_decoded);
        // Preserve current primary/secondary demodulator
        const freq_mod = getCurrentDemodulator();
        yield writeSettings(sdr_profile, [
            { name: 'center_freq', value: `${freq_new.value}` },
            { name: 'center_freq-exponent', value: `${freq_new.exp}` },
            { name: 'start_mod', value: `${freq_mod}` },
        ]);
        updateDisplayedWaterfall();
        updateDisplayedZoomLevel();
    });
}
function getCurrentGain() {
    const $gain_level = $('#gain-level');
    if ($gain_level === undefined) {
        return undefined;
    }
    const is_mode_manual = !$gain_level.prop('disabled');
    if (is_mode_manual) {
        const value = Number($gain_level.val());
        if (value === undefined || Number.isNaN(value)) {
            return undefined;
        }
        return {
            type: 'manual',
            value: Number(value.toFixed(1)),
        };
    }
    else {
        return {
            type: 'auto',
        };
    }
}
function getGainFromSettings(settings) {
    const value = getSettingValueByName(settings, 'rf_gain-select');
    switch (value) {
        case 'manual': {
            const value = Number(getSettingValueByName(settings, 'rf_gain-manual'));
            if (value === undefined || Number.isNaN(value)) {
                return undefined;
            }
            return {
                type: 'manual',
                value: Number(value.toFixed(1)),
            };
        }
        case 'auto': {
            return {
                type: 'auto',
            };
        }
    }
    return undefined;
}
function getSecondaryGainFromSettings(settings) {
    const value = Number(getSettingValueByName(settings, 'rfgain_sel'));
    if (value === undefined || Number.isNaN(value)) {
        return undefined;
    }
    return { value: Number(value.toFixed(1)) };
}
function setGain(gain) {
    return __awaiter(this, void 0, void 0, function* () {
        const sdr_profile = getSelectedProfile();
        if (sdr_profile === undefined) {
            return undefined;
        }
        if (gain.type === 'auto') {
            // Save auto gain to profile "Unlocked"
            const sdr_settings = yield writeSettings(sdr_profile, [
                { name: 'rf_gain-select', value: 'auto' }
            ]);
            if (sdr_settings !== undefined) {
                yield updateDisplayedGain(sdr_profile, sdr_settings);
            }
            return;
        }
        const gain_range = getSdrGainRange(sdr_profile);
        if (gain_range === undefined || Number.isNaN(gain.value)) {
            return undefined;
        }
        const gain_new = clampGainToRange(gain_range, { value: Number(gain.value.toFixed(1)) });
        // Save new gain to profile "Unlocked"
        const sdr_settings = yield writeSettings(sdr_profile, [
            { name: 'rf_gain-select', value: 'manual' },
            { name: 'rf_gain-manual', value: `${gain_new.value}` }
        ]);
        if (sdr_settings !== undefined) {
            yield updateDisplayedGain(sdr_profile, sdr_settings);
        }
    });
}
function setSecondaryGain(gain) {
    return __awaiter(this, void 0, void 0, function* () {
        const sdr_profile = getSelectedProfile();
        if (sdr_profile === undefined) {
            return undefined;
        }
        const secondary_gain_range = getSdrSecondaryGainRange(sdr_profile);
        if (secondary_gain_range === undefined || Number.isNaN(gain.value)) {
            return undefined;
        }
        const gain_new = clampGainToRange(secondary_gain_range, { value: Number(gain.value.toFixed(1)) });
        // Save new gain to profile "Unlocked"
        const sdr_settings = yield writeSettings(sdr_profile, [
            { name: 'rfgain_sel', value: `${gain_new.value}` }
        ]);
        if (sdr_settings !== undefined) {
            yield updateDisplayedSecondaryGain(sdr_profile, sdr_settings);
        }
    });
}
function toggleGainMode() {
    return __awaiter(this, void 0, void 0, function* () {
        const current_gain = getCurrentGain();
        if (current_gain === undefined) {
            return undefined;
        }
        const $gain_level = $('#gain-level');
        const [disable_attr, gain_value] = (() => {
            switch (current_gain.type) {
                case 'auto': return [false, { type: 'manual', value: Number($gain_level.val()) }];
                case 'manual': return [true, { type: 'auto' }];
            }
        })();
        $gain_level.prop('disabled', disable_attr);
        return yield setGain(gain_value);
    });
}
// Demodulator related stuff
function getCurrentDemodulator() {
    var _a;
    const demodulator = (_a = getDemodulators()) === null || _a === void 0 ? void 0 : _a[0];
    if (demodulator === undefined) {
        return 'nfm';
    }
    const secondary_demod = demodulator.get_secondary_demod();
    if (secondary_demod !== false) {
        return secondary_demod;
    }
    return demodulator.get_modulation();
}
// Displayed elements/values related stuff
function updateDisplayedWaterfall() {
    if (!superpower_settings.waterfall_refreshing) {
        return;
    }
    waterfall_measure_minmax_now = true;
}
function updateDisplayedZoomLevel() {
    if (!superpower_settings.increase_zoom_levels) {
        return;
    }
    // Smoother zooming
    zoom_levels_count = superpower_settings.increase_zoom_levels_count;
    mkzoomlevels();
}
function updateDisplayedGain(sdr_profile, sdr_settings) {
    return __awaiter(this, void 0, void 0, function* () {
        const gain_range = getSdrGainRange(sdr_profile);
        if (gain_range === undefined) {
            return undefined;
        }
        const settings_gain = getGainFromSettings(sdr_settings);
        if (settings_gain === undefined) {
            return undefined;
        }
        switch (settings_gain.type) {
            case 'auto': {
                $('#gain-mode').html(`Gain: auto`)
                    .prop('title', 'Gain (auto)');
                $('#gain-level').prop('title', `Gain (auto)`)
                    .prop('disabled', true);
                break;
            }
            case 'manual': {
                const gain_value = settings_gain.value;
                const displayed_gain = gain_range.reversed ? -gain_value : gain_value;
                $('#gain-mode').html(`Gain: ${displayed_gain}dB`)
                    .prop('title', `Gain (${displayed_gain}dB)`);
                $('#gain-level').prop('title', `Gain (${displayed_gain}dB)`)
                    .prop('value', gain_value)
                    .prop('disabled', false);
                break;
            }
        }
    });
}
function updateDisplayedSecondaryGain(sdr_profile, sdr_settings) {
    return __awaiter(this, void 0, void 0, function* () {
        const secondary_gain_range = getSdrSecondaryGainRange(sdr_profile);
        if (secondary_gain_range === undefined) {
            return undefined;
        }
        const settings_secondary_gain = getSecondaryGainFromSettings(sdr_settings);
        if (settings_secondary_gain === undefined) {
            return undefined;
        }
        const secondary_gain_value = settings_secondary_gain.value;
        const displayed_secondary_gain = secondary_gain_range.reversed ? -secondary_gain_value : secondary_gain_value;
        $('#secondary-gain-level')
            .prop('title', `Secondary gain (${displayed_secondary_gain}dB)`)
            .prop('value', secondary_gain_value);
    });
}
function updateDisplayedGainRange(sdr_profile, sdr_settings) {
    return __awaiter(this, void 0, void 0, function* () {
        const gain_range = getSdrGainRange(sdr_profile);
        if (gain_range === undefined) {
            return undefined;
        }
        const $gain_level = $('#gain-level');
        $gain_level.prop({
            'min': gain_range.min.value,
            'max': gain_range.max.value,
            'step': gain_range.step,
        });
        if (!gain_range.reversed) {
            $gain_level.css({ 'transform': '' });
            $gain_level.off('wheel');
        }
        else {
            $gain_level.css({ 'transform': 'rotate(180deg)' });
            $gain_level.off('wheel');
            $gain_level.on('wheel', (event) => {
                const gain = clampGainToRange(gain_range, {
                    value: (() => {
                        const value = Number($gain_level.val());
                        const step = Number($gain_level.prop('step'));
                        if (event.originalEvent.deltaY > 0) {
                            return value + step;
                        }
                        else {
                            return value - step;
                        }
                    })(),
                });
                $gain_level.prop('value', gain.value);
                $gain_level.trigger('change');
                event.preventDefault();
                event.stopPropagation();
            });
        }
        const settings_gain = getGainFromSettings(sdr_settings);
        if (settings_gain === undefined) {
            return undefined;
        }
        const gain_value = (() => {
            switch (settings_gain.type) {
                case 'auto': return rangeMidpoint(gain_range);
                case 'manual': return settings_gain.value;
            }
        })();
        $gain_level.prop('value', gain_value);
    });
}
function updateDisplayedSecondaryGainRange(sdr_profile, sdr_settings) {
    return __awaiter(this, void 0, void 0, function* () {
        const $secondary_gain_level = $('#secondary-gain-level');
        const secondary_gain_range = getSdrSecondaryGainRange(sdr_profile);
        if (secondary_gain_range === undefined) {
            $secondary_gain_level.hide();
            $secondary_gain_level.prop('disabled', true);
            return undefined;
        }
        $secondary_gain_level.show();
        $secondary_gain_level.prop('disabled', false);
        $secondary_gain_level.prop({
            'min': secondary_gain_range.min.value,
            'max': secondary_gain_range.max.value,
            'step': secondary_gain_range.step,
        });
        if (!secondary_gain_range.reversed) {
            $secondary_gain_level.css({ 'transform': '' });
            $secondary_gain_level.off('wheel');
        }
        else {
            $secondary_gain_level.css({ 'transform': 'rotate(180deg)' });
            $secondary_gain_level.off('wheel');
            $secondary_gain_level.on('wheel', (event) => {
                const secondary_gain = clampGainToRange(secondary_gain_range, {
                    value: (() => {
                        const value = Number($secondary_gain_level.val());
                        const step = Number($secondary_gain_level.prop('step'));
                        if (event.originalEvent.deltaY > 0) {
                            return value + step;
                        }
                        else {
                            return value - step;
                        }
                    })(),
                });
                $secondary_gain_level.prop('value', secondary_gain.value);
                $secondary_gain_level.trigger('change');
                event.preventDefault();
                event.stopPropagation();
            });
        }
        const settings_secondary_gain = getSecondaryGainFromSettings(sdr_settings);
        if (settings_secondary_gain === undefined) {
            return undefined;
        }
        const gain_value = settings_secondary_gain.value;
        $secondary_gain_level.prop('value', gain_value);
    });
}
// New functionality/elements related stuff
function modifySpectrum() {
    var _a;
    if (superpower_settings.spectrum_fluidity) {
        // Replace instance of spectrum to improve fps
        const canvas = (_a = $('#openwebrx-spectrum-canvas')) === null || _a === void 0 ? void 0 : _a[0];
        if (canvas === undefined) {
            return undefined;
        }
        spectrum = undefined;
        spectrum = new Spectrum(canvas, superpower_settings.spectrum_fluidity_refresh_time);
    }
    if (superpower_settings.spectrum_enlarge) {
        // Change height of spectrum and remove background image and add event on hide/show spectrum
        $('#openwebrx-frequency-container').css({
            'background-image': 'none',
        });
        const spectrum_container = $('.openwebrx-spectrum-container');
        spectrum_container.onClassChange((spectrum_container) => {
            const height = (() => {
                if (spectrum_container.hasClass('expanded')) {
                    return superpower_settings.spectrum_enlarge_height;
                }
                else {
                    return '';
                }
            })();
            spectrum_container.css({
                'maxHeight': height,
                'height': height,
            });
        });
    }
}
function addProfileMemory() {
    var _a;
    if (!superpower_settings.profile_memory) {
        return;
    }
    const $profiles_listbox = $('#openwebrx-sdr-profiles-listbox');
    const last_profile_item_key = 'openwebrx-last-profile';
    const last_profile = localStorage.getItem(last_profile_item_key);
    if (last_profile !== null) {
        if (((_a = $profiles_listbox.find(`option[value='${last_profile}']`)) === null || _a === void 0 ? void 0 : _a.length) === 0) {
            localStorage.removeItem(last_profile_item_key);
        }
        else {
            $profiles_listbox.val(last_profile).trigger('change');
        }
    }
    $profiles_listbox.on('change', () => {
        const sdr_profile = getSelectedProfile();
        if (sdr_profile === undefined) {
            localStorage.removeItem(last_profile_item_key);
        }
        else {
            localStorage.setItem(last_profile_item_key, `${sdr_profile.device}|${sdr_profile.name}`);
        }
    });
}
function addFrequencyChange() {
    if (!superpower_settings.frequency_change) {
        return;
    }
    // Place jump arrow DIVs
    const $frequencies_div = $('.frequencies-container');
    $frequencies_div.prepend('<div id="freq-jump-prev" class="openwebrx-button"><</div>');
    $frequencies_div.append('<div id="freq-jump-next" class="openwebrx-button">></div>');
    $('#freq-jump-prev').on('click', () => __awaiter(this, void 0, void 0, function* () {
        yield setFrequency({ type: 'prev' });
    }));
    $('#freq-jump-next').on('click', () => __awaiter(this, void 0, void 0, function* () {
        yield setFrequency({ type: 'next' });
    }));
    // Add change event on freq input element
    const $panel_receiver = $('#openwebrx-panel-receiver');
    $panel_receiver.find('.input-group > input').on('change', (event) => __awaiter(this, void 0, void 0, function* () {
        const input_exp = $panel_receiver.find('.input-group > select').val();
        const input_freq = $(event.target).val();
        const freq = {
            type: 'value',
            exp: Number(input_exp.length !== 0 ? input_exp : NaN),
            value: Number(input_freq.length !== 0 ? input_freq : NaN),
        };
        yield setFrequency(freq);
    }));
    addProfileChangeEvent((sdr_profile, sdr_settings) => {
        if (!isProfileUnlocked(sdr_profile) || sdr_settings === undefined) {
            $('#freq-jump-prev').hide();
            $('#freq-jump-next').hide();
        }
        else {
            $('#freq-jump-prev').show();
            $('#freq-jump-next').show();
        }
    });
}
function addGainChange(sdr_profile) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!superpower_settings.gain_change) {
            return;
        }
        // Place gain title and slider
        $('#openwebrx-section-modes').before(`\
		<div id="openwebrx-section-gain" class="openwebrx-section-divider" onclick="UI.toggleSection(this);">▾ Gain</div>
		<div class="openwebrx-section">
			<div class="openwebrx-panel-line" style="display: flex;"> \
				<div id="gain-mode" class="openwebrx-button openwebrx-slider-button" title="Gain mode" style="font-size: 9pt">Gain: --.-</div> \
				<input id="gain-level" class="openwebrx-panel-slider" title="Gain" type="range" style="flex-grow: 1" disabled="" /> \
				<input id="secondary-gain-level" class="openwebrx-panel-slider" title="Secondary gain" type="range" style="width: 24px" disabled="" />
			</div>
		</div>`);
        const $gain_mode = $('#gain-mode');
        const $gain_level = $('#gain-level');
        const $secondary_gain_level = $('#secondary-gain-level');
        // Add click event on gain mode toggle button
        $gain_mode.on('click', () => __awaiter(this, void 0, void 0, function* () {
            yield toggleGainMode();
        }));
        // Add input/change event on gain level slider
        const sdr_settings = yield readSettings(sdr_profile);
        if (sdr_settings !== undefined) {
            $gain_level.prop('disabled', false);
        }
        const gain_set_debounce_time = 80; // in ms
        $gain_level.on('input change', debounce(gain_set_debounce_time, (gain) => __awaiter(this, void 0, void 0, function* () {
            yield setGain(gain);
        })), (event) => {
            event.data({ type: 'manual', value: Number($(event.target).val()) });
        });
        $secondary_gain_level.hide();
        $secondary_gain_level.on('input change', debounce(gain_set_debounce_time, (gain) => __awaiter(this, void 0, void 0, function* () {
            yield setSecondaryGain(gain);
        })), (event) => {
            event.data({ value: Number($(event.target).val()) });
        });
        addProfileChangeEvent((sdr_profile, sdr_settings) => {
            const $section_gain = $('#openwebrx-section-gain');
            if (!isProfileUnlocked(sdr_profile) || sdr_settings === undefined) {
                $section_gain.hide();
                $section_gain.next('.openwebrx-section:first').hide();
            }
            else {
                $section_gain.show();
                $section_gain.next('.openwebrx-section:first').show();
            }
        });
    });
}
function addProfileChangeEvent(callback) {
    $(document).on('event:superpower_sdr_profile_changed', ({}, sdr_profile, sdr_settings) => {
        callback(sdr_profile, sdr_settings);
    });
}
function triggerProfileChange() {
    return __awaiter(this, void 0, void 0, function* () {
        const sdr_profile = getSelectedProfile();
        if (sdr_profile === undefined) {
            return undefined;
        }
        const sdr_settings = yield readSettings(sdr_profile);
        $(document).trigger('event:superpower_sdr_profile_changed', [sdr_profile, sdr_settings]);
        if (sdr_settings === undefined) {
            return;
        }
        yield updateDisplayedGain(sdr_profile, sdr_settings);
        yield updateDisplayedSecondaryGain(sdr_profile, sdr_settings);
        yield updateDisplayedGainRange(sdr_profile, sdr_settings);
        yield updateDisplayedSecondaryGainRange(sdr_profile, sdr_settings);
        updateDisplayedWaterfall();
        updateDisplayedZoomLevel();
    });
}
$(document).on('DOMContentLoaded', () => {
    waitFor(() => 'spectrum' in window && spectrum !== undefined, () => {
        modifySpectrum();
    });
    waitFor(() => getSelectedProfile() !== undefined, () => __awaiter(this, void 0, void 0, function* () {
        const sdr_profile = getSelectedProfile();
        if (sdr_profile === undefined) {
            return undefined;
        }
        $('#openwebrx-sdr-profiles-listbox').on('change', () => __awaiter(this, void 0, void 0, function* () {
            yield triggerProfileChange();
        }));
        addProfileMemory();
        addFrequencyChange();
        yield addGainChange(sdr_profile);
        yield triggerProfileChange();
    }));
});
