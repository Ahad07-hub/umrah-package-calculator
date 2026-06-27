function num(id) {
  var el = document.getElementById(id);
  var v = parseFloat(el.value);
  return isNaN(v) ? 0 : v;
}

function text(id) {
  var el = document.getElementById(id);
  return (el.value || '').trim();
}

function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

function fmtDec(n) {
  // Keep up to 2 decimals but drop trailing zeros, for rates/subtotals shown in breakdown
  return (Math.round(n * 100) / 100).toLocaleString('en-US');
}

function roomLabel(value) {
  var labels = { sharing: 'Sharing', double: 'Double', triple: 'Triple', quad: 'Quad' };
  return labels[value] || value;
}

function isChecked(id) {
  return document.getElementById(id).checked;
}

/* ---------- Hotel per-night cost (price x nights, with optional split period) ---------- */

function hotelTotal(city) {
  var price1 = num(city + '-price');
  var nights1 = num(city + '-nights');
  var total = price1 * nights1;
  var label = 'SR' + fmtDec(price1) + ' x ' + fmt(nights1) + ' nights';

  if (isChecked(city + '-split-toggle')) {
    var price2 = num(city + '-price-2');
    var nights2 = num(city + '-nights-2');
    total += price2 * nights2;
    label += ' + SR' + fmtDec(price2) + ' x ' + fmt(nights2) + ' nights';
  }

  return { total: total, label: label };
}

/* ---------- Per traveler-group calculation ----------
   Adults: ((hotelTotal + adult PEX) x Riyal rate) + adult ticket, per adult, x adult count.
   Children/Infants: hotel cost is NOT included (they don't get a counted hotel share) —
   only (PEX x Riyal rate) + ticket, per person, x their count.
*/

function adultGroup(hotelSum, rate) {
  var count = num('adult-count');
  var pex = num('adult-pex');
  var ticket = num('adult-ticket');

  var perPersonConverted = (hotelSum + pex) * rate;
  var perPerson = perPersonConverted + ticket;
  var groupTotal = perPerson * count;

  return {
    count: count, pex: pex, ticket: ticket,
    perPersonConverted: perPersonConverted,
    perPerson: perPerson, groupTotal: groupTotal
  };
}

function dependentGroup(prefix, active, rate) {
  if (!active) {
    return { count: 0, pex: 0, ticket: 0, perPersonConverted: 0, perPerson: 0, groupTotal: 0 };
  }
  var count = num(prefix + '-count');
  var pex = num(prefix + '-pex');
  var ticket = num(prefix + '-ticket');

  var perPersonConverted = pex * rate;
  var perPerson = perPersonConverted + ticket;
  var groupTotal = perPerson * count;

  return {
    count: count, pex: pex, ticket: ticket,
    perPersonConverted: perPersonConverted,
    perPerson: perPerson, groupTotal: groupTotal
  };
}

/* ---------- Main calculation ---------- */

function calculate() {
  var mk = hotelTotal('mk');
  var md = hotelTotal('md');
  var hotelSum = mk.total + md.total;

  var rate = num('rate');
  var commission = num('commission');
  var discountValue = num('discount');
  var discountType = document.getElementById('discount-type').value;

  var adults = adultGroup(hotelSum, rate);
  var children = dependentGroup('child', isChecked('child-toggle'), rate);
  var infants = dependentGroup('infant', isChecked('infant-toggle'), rate);

  var totalBeforeDiscount = adults.groupTotal + children.groupTotal + infants.groupTotal;

  var discountAmount = discountType === 'percent'
    ? totalBeforeDiscount * (discountValue / 100)
    : discountValue;

  var totalNoComm = totalBeforeDiscount - discountAmount;
  var totalWithComm = totalNoComm + commission;

  document.getElementById('total-no-comm').textContent = 'PKR ' + fmt(totalNoComm);
  document.getElementById('total-with-comm').textContent = 'PKR ' + fmt(totalWithComm);

  var discountLabel = discountType === 'percent'
    ? discountValue + '% (' + fmt(discountAmount) + ')'
    : fmt(discountAmount);

  var lines = [];
  lines.push('Hotels: ' + mk.label + ' (Makkah) + ' + md.label + ' (Madina) = SR' + fmtDec(hotelSum));
  lines.push('Adults: (SR' + fmtDec(hotelSum) + ' + SR' + fmtDec(adults.pex) + ' visa) x ' + (rate || 0) +
    ' rate = PKR ' + fmt(adults.perPersonConverted) + ' + ticket PKR ' + fmt(adults.ticket) +
    ' = PKR ' + fmt(adults.perPerson) + ' per adult  x  ' + fmt(adults.count) + ' adults = PKR ' + fmt(adults.groupTotal));

  if (children.count > 0) {
    lines.push('Children: (SR' + fmtDec(children.pex) + ' visa x ' + (rate || 0) + ' rate = PKR ' + fmt(children.perPersonConverted) +
      ') + ticket PKR ' + fmt(children.ticket) + ' = PKR ' + fmt(children.perPerson) + ' per child  x  ' + fmt(children.count) + ' = PKR ' + fmt(children.groupTotal));
  }
  if (infants.count > 0) {
    lines.push('Infants: (SR' + fmtDec(infants.pex) + ' visa x ' + (rate || 0) + ' rate = PKR ' + fmt(infants.perPersonConverted) +
      ') + ticket PKR ' + fmt(infants.ticket) + ' = PKR ' + fmt(infants.perPerson) + ' per infant  x  ' + fmt(infants.count) + ' = PKR ' + fmt(infants.groupTotal));
  }

  lines.push('Subtotal PKR ' + fmt(totalBeforeDiscount) + '  -  discount ' + discountLabel + '  +  commission ' + fmt(commission) + ' = PKR ' + fmt(totalWithComm));

  document.getElementById('breakdown').textContent = lines.join('   |   ');

  updatePrintQuote({
    mk: mk, md: md,
    adults: adults, children: children, infants: infants,
    rate: rate, discountType: discountType, discountValue: discountValue,
    discountAmount: discountAmount, totalWithComm: totalWithComm
  });
}

/* ---------- Print quote population ---------- */

function fillTravelerRow(prefix, group, rowId) {
  var row = document.getElementById(rowId);
  if (group.count > 0) {
    row.style.display = '';
    document.getElementById('q-' + prefix + '-count').textContent = fmt(group.count);
    document.getElementById('q-' + prefix + '-pex').textContent = 'SR ' + fmtDec(group.pex);
    document.getElementById('q-' + prefix + '-ticket').textContent = 'PKR ' + fmt(group.ticket);
    document.getElementById('q-' + prefix + '-per-person').textContent = 'PKR ' + fmt(group.perPerson);
    document.getElementById('q-' + prefix + '-subtotal').textContent = 'PKR ' + fmt(group.groupTotal);
  } else {
    row.style.display = 'none';
  }
}

function updatePrintQuote(data) {
  document.getElementById('q-mk-name').textContent = text('mk-name') || 'Not specified';
  document.getElementById('q-mk-room').textContent = roomLabel(document.getElementById('mk-room-type').value);
  document.getElementById('q-mk-stay').textContent = data.mk.label + ' = SR' + fmtDec(data.mk.total);

  document.getElementById('q-md-name').textContent = text('md-name') || 'Not specified';
  document.getElementById('q-md-room').textContent = roomLabel(document.getElementById('md-room-type').value);
  document.getElementById('q-md-stay').textContent = data.md.label + ' = SR' + fmtDec(data.md.total);

  document.getElementById('q-rate').textContent = '1 SR = PKR ' + (data.rate || 0);

  fillTravelerRow('adult', data.adults, 'q-adults-row');
  fillTravelerRow('child', data.children, 'q-children-row');
  fillTravelerRow('infant', data.infants, 'q-infants-row');

  var discountRow = document.getElementById('q-discount-row');
  if (data.discountAmount > 0) {
    discountRow.style.display = '';
    document.getElementById('q-discount').textContent =
      data.discountType === 'percent'
        ? data.discountValue + '% (PKR ' + fmt(data.discountAmount) + ')'
        : 'PKR ' + fmt(data.discountAmount);
  } else {
    discountRow.style.display = 'none';
  }

  document.getElementById('q-final').textContent = 'PKR ' + fmt(data.totalWithComm);

  document.getElementById('quote-date').textContent =
    'Issued ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ---------- Wiring ---------- */

var baseFieldIds = [
  'mk-name', 'mk-room-type', 'mk-price', 'mk-nights', 'mk-price-2', 'mk-nights-2',
  'md-name', 'md-room-type', 'md-price', 'md-nights', 'md-price-2', 'md-nights-2',
  'adult-count', 'adult-pex', 'adult-ticket',
  'child-count', 'child-pex', 'child-ticket',
  'infant-count', 'infant-pex', 'infant-ticket',
  'rate', 'discount', 'discount-type', 'commission'
];

var splitToggleIds = ['mk-split-toggle', 'md-split-toggle'];
var travelerToggleIds = ['child-toggle', 'infant-toggle'];

baseFieldIds.forEach(function (id) {
  var el = document.getElementById(id);
  el.addEventListener('input', calculate);
  el.addEventListener('change', calculate);
});

splitToggleIds.forEach(function (id) {
  var city = id.split('-')[0];
  var checkbox = document.getElementById(id);
  var fieldsBlock = document.getElementById(city + '-split-fields');

  checkbox.addEventListener('change', function () {
    fieldsBlock.hidden = !checkbox.checked;
    if (!checkbox.checked) {
      document.getElementById(city + '-price-2').value = '';
      document.getElementById(city + '-nights-2').value = '';
    }
    calculate();
  });
});

travelerToggleIds.forEach(function (id) {
  var group = id.split('-')[0];
  var checkbox = document.getElementById(id);
  var fieldsBlock = document.getElementById(group + '-fields');

  checkbox.addEventListener('change', function () {
    fieldsBlock.hidden = !checkbox.checked;
    if (!checkbox.checked) {
      document.getElementById(group + '-count').value = '';
      document.getElementById(group + '-pex').value = '';
      document.getElementById(group + '-ticket').value = '';
    }
    calculate();
  });
});

document.getElementById('print-btn').addEventListener('click', function () {
  calculate();
  window.print();
});

document.getElementById('reset-btn').addEventListener('click', function () {
  baseFieldIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el.tagName === 'SELECT') {
      el.selectedIndex = 0;
    } else {
      el.value = '';
    }
  });
  splitToggleIds.concat(travelerToggleIds).forEach(function (id) {
    var checkbox = document.getElementById(id);
    checkbox.checked = false;
  });
  document.getElementById('mk-split-fields').hidden = true;
  document.getElementById('md-split-fields').hidden = true;
  document.getElementById('child-fields').hidden = true;
  document.getElementById('infant-fields').hidden = true;
  calculate();
});

calculate();
