var unique_id = {
    base: null,
    index: 1
};

module.exports = function() {
    var date, base;

    //get the current date (minus year information)
    date = new Date();

    //get the base value
    base = date.valueOf().toString(36);

    //if the base has not changed since last request then increment the index, otherwise update the base and reset the index
    if (base === unique_id.base) {
        unique_id.index++;
    } else {
        unique_id.base = base;
        unique_id.index = 1;
    }

    //return the new id - with a base length of 9 we accommodate until April 22 5188 at 5:04:28 GMT. With 8 it would be until May 25 2059 11:38:27 GMT.
    return addZeros(base, 9) + '-' + addZeros(unique_id.index.toString(36), 4);
};

function addZeros(str, length) {
    while (str.length < length) str = '0' + str;
    return str;
}