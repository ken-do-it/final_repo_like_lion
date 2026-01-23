import en from './lang/en';
import ko from './lang/ko';
import jp from './lang/jp';
import zh from './lang/zh';

export const API_LANG_CODES = {
    English: 'eng_Latn',
    '\uD55C\uAD6D\uC5B4': 'kor_Hang',
    '\u65E5\u672C\u8A9E': 'jpn_Jpan',
    '\u4E2D\u6587': 'zho_Hans',
};

export const translations = {
    English: en,
    '\uD55C\uAD6D\uC5B4': ko,
    '\u65E5\u672C\u8A9E': jp,
    '\u4E2D\u6587': zh,
};
