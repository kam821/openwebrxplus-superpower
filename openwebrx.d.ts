// Types declarations
declare class UI {
    static toggleSection(el: HTMLElement): void;
}

declare class Demodulator {
    get_modulation(): string;
    get_secondary_demod(): string | false;
}
declare function getDemodulators() : Demodulator[];

declare class Spectrum {
    constructor(el: HTMLElement, msec: number);
}
declare var spectrum : Spectrum | undefined;

declare function get_visible_freq_range() : { start: number, center: number, end: number };

declare function mkzoomlevels(): void;
declare var waterfall_measure_minmax_now : boolean;
declare var zoom_levels_count : number;
declare var zoom_levels : number[];