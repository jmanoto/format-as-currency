angular
.module('jmanoto/formatAsCurrency', [])
.service('formatAsCurrencyUtilities', function () {

  // (haystack: String, needles: Array<String>) => Number
  // eg. ('foo', 'o') => 2
  this.occurrences = function (haystack, needles) {

    if (!angular.isString(haystack)) {
      throw new TypeError ('formatAsCurrencyUtilities#occurences expects its 1st argument to be a String, but was given ' + haystack)
    }

    if (!angular.isArray(needles)) {
      throw new TypeError ('formatAsCurrencyUtilities#occurences expects its 2nd argument to be an Array, but was given ' + needles)
    }

    needles.forEach(function (needle, n) {
      if (!angular.isString(needle)) {
        throw new TypeError ('formatAsCurrencyUtilities#occurences expects needles to be Strings, but needle #' + n + ' is ' + needle)
      }
    })

    return needles

      // get counts
      .map(function (needle) {
        _needle = needle
          .replace(/\[/g, '\\[')
          .replace(/\]/g, '\\]')
        return (
          haystack.match(new RegExp('[' + _needle + ']', 'g')) || []
        ).length
      })

      // sum counts
      .reduce(function (prev, cur) {
        return prev + cur
      })
  }

  // (currencyString: String) => Number
  // eg. "$123.00" => 123.00
  this.toFloat = function (currencyString) {

    if (!angular.isString(currencyString)) {
      throw new TypeError ('formatAsCurrencyUtilities#toFloat expects its 1st argument to be a String, but was given ' + currencyString)
    }

    return parseFloat(currencyString.replace(/(\$|\,)+/g, ''), 10)
  }

})
.directive('formatAsCurrency', function ($filter, $locale, formatAsCurrencyUtilities) {

  var CURRENCY_SYMBOL = $locale.NUMBER_FORMATS.CURRENCY_SYM

  var util = formatAsCurrencyUtilities;

  return {
    require: 'ngModel',
    restrict: 'A',
    link: function (scope, element, attrs, ngModel) {

      var isAngular13 = (angular.version.major === 1 && angular.version.minor <= 3);
      var lastChar = null;

      ngModel.$formatters.push(function (value) {
        if (value === 0.0 || isNaN(value)) {
          if (lastChar === ZERO_ALPHA || lastChar === ZERO_NUMERIC) {
            return '$0';
          } else if (lastChar === PERIOD_ALPHA || lastChar === PERIOD_NUMERIC){
            return '$0.';
          } else {
            return '$';
          }
        } else {
          var formatted = $filter('currency')(value);
          // console.log("formatting", formatted, value);
          if (formatted.indexOf('.00') >= 0 && (lastChar != PERIOD_ALPHA && lastChar != PERIOD_NUMERIC)) {
            // console.log("Removing cents");
            formatted = formatted.substring(0, formatted.indexOf('.'));
          }
          return formatted;
        }
      })

      ngModel.$parsers.push(function (value) {

        // console.log("parsing", value);

        var number = util
          .toFloat(value)
          .toFixed(2)

        var isValueNumber = isAngular13 ? !isNaN(number) : ngModel.$validators.currency(number);
        // console.log('parser', ngModel.$validators.currency(number), isValueNumber, number);

        if (isValueNumber) {
        // if (isValueNumber) {

          var formatted = $filter('currency')(number)
          var specialCharacters = [',', CURRENCY_SYMBOL]

          // did we add a comma or currency symbol?
          var specialCharactersCountChange = [value, formatted]
            .map(function (string) {
              return util.occurrences(string, specialCharacters)
            })
            .reduce(function (prev, cur) {
              return cur - prev
            })

          // compute the new selection range, correcting for
          // formatting introduced by the currency $filter
          var selectonRange = [
            element[0].selectionStart,
            element[0].selectionEnd
          ].map(function (position) {
            return position + specialCharactersCountChange
          });

          if (formatted === '$0.00') { formatted = '$' }
          if (formatted.indexOf('.00') > 0 && (lastChar != PERIOD_ALPHA && lastChar != PERIOD_NUMERIC)) {
            formatted = formatted.substring(0, formatted.indexOf('.'));
          }

          // set the formatted value in the view
          ngModel.$setViewValue(formatted);
          ngModel.$render();

          // set the cursor back to its expected position
          // (since $render resets the cursor the the end)
          ('setSelectionRange' in element[0]) && element[0].setSelectionRange(selectonRange[0], selectonRange[1])
        }

        return number

      });

      var BACKSPACE = 8;
      var DELETE = 46;
      var PERIOD_ALPHA = 190;
      var PERIOD_NUMERIC = 110;
      var ZERO_ALPHA = 48;
      var ZERO_NUMERIC = 96;

      // Handle keyboard presses
      element.on('keydown', function(event) {
        var charCode = event.which || event.keyCode;
        lastChar = charCode;

        // console.log("Last Char: ", lastChar);

        switch (charCode) {
          case BACKSPACE: // Backspace
            var pointIndex = element[0].value.indexOf('.');
            if (element[0].selectionStart === element[0].selectionEnd && element[0].selectionStart === pointIndex + 1) {
              // console.log("Backspacing Point", pointIndex, element[0].selectionStart);
              element[0].value = element[0].value.substring(0, pointIndex);
              ngModel.$setViewValue(element[0].value);
              return false;
            }
            break;
          case DELETE: // Delete
            var pointIndex = element[0].value.indexOf('.');
            if (element[0].selectionStart === element[0].selectionEnd && element[0].selectionStart === pointIndex) {
              // console.log("Deleting Point", pointIndex, element[0].selectionStart);
              element[0].value = element[0].value.substring(0, pointIndex);
              ngModel.$setViewValue(element[0].value);
              return false;
            }
            break;
          case PERIOD_NUMERIC:
          case PERIOD_ALPHA:
            if (element[0].value.indexOf('.') < 0) {
              // Check if a zero should be prepended
              if (element[0].value === '$') {
                element[0].value = '$0';
              }

              // No period existing
              element[0].value = element[0].value.substring(0, element[0].selectionStart) + '.00';

              element[0].selectionStart = element[0].selectionEnd = element[0].value.length - '00'.length;
              return false;
            } else {
              // Already has period
              element[0].value = element[0].value.substring(0, element[0].selectionStart) + '.00';
              element[0].selectionStart = element[0].selectionEnd = element[0].value.length - '00'.length;
              return true;
            }
            break;
          case ZERO_NUMERIC:
          case ZERO_ALPHA:
            if (element[0].value.indexOf('.') >= 0) {
              if (element[0].selectionStart > element[0].value.indexOf('.')) {
                element[0].selectionStart = element[0].selectionStart + 1;
                return false;
              }
            }
            break;
        }

        return true;

      });

      // Version switch
      if (angular.version.major === 1 && angular.version.minor <= 2) {
        // Old version (angular 1.2)
        scope.$watch(function() {
          // console.log("watching", ngModel.$modelValue);
          return !isNaN(ngModel.$modelValue);
        }, function(validity) {
          // console.log("setting validity", validity)
          ngModel.$setValidity('formatAsCurrency', validity);
        });
      } else {
        // Modern Angular version
        ngModel.$validators.currency = function (modelValue) {
          return !isNaN(modelValue)
        }
      }


    }
  }

})
