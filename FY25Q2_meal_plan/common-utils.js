

function calcMenuHash(date='', type='', menu_name='') {
  if (date instanceof Date) {
    return date.toISOString() + '-' + type + '-' + menu_name;
  } else if (typeof date === 'string') {
    return date + '-' + type + '-' + menu_name;
  } else {
    throw new Error(dateがDateでもStringでもありません);
  }
}