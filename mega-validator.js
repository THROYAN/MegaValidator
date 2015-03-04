/**
 * Валидатор объектов
 *
 * @author Oleg Postupalsky <throyan@gmail.com>
 *
 * @requires jQuery[v1.7]
 */
var MegaValidator = {};

/**
 * Результат последней валидации
 * @type {object}
 */
MegaValidator.lastResult = null;
MegaValidator.lastObject = null;

/**
 * если false и поле не required, то не будет валидировать
 * вообще будет валидировать всё, что в массиве requiredValidators
 * если true, то все поля на которых есть валидаторы становятся типа required
 * @type {Boolean}
 */
MegaValidator.strictlyConditions = false;

/**
 * Вот эта штука и проверяет флажок strictlyConditions
 * @param  {mixed} value Валидируемое значение
 * @return {boolean} Результат
 */
MegaValidator.maybeNull = function (value) {
    return !MegaValidator.strictlyConditions && MegaValidator.isNull(value);
}

MegaValidator.isNull = function (value) {
    return (typeof value === 'number' && isNaN(value)) || value === undefined || value === null || value === '';
}

/**
 * Добавляет валидатор в список валидаторов
 * @param {string} name           Имя
 * @param {function} validFunction  Функция валидации
 * @param {string} defaultMessage Дефолтное сообщение об ошибке
 */
MegaValidator.addValidator = function (name, validFunction, defaultMessage, required) {
    if (name in MegaValidator.validators) {
        throw new Error('Same validator "' + name + '" is already exists');
    }
    MegaValidator.validators[name] = validFunction;
    MegaValidator.defaultMessages[name] = defaultMessage;

    if (required === true) {
        MegaValidator.requiredValidators.push(name);
    }
}

/**
 * Добавляет "модуль" в список модулей
 * @param {string} name           Имя
 * @param {function} moduleFunction Угадай
 */
MegaValidator.addModule = function (name, moduleFunction) {
    if (name in MegaValidator.modules) {
        throw new Error('Same module "' + name + '" is already exists');
    }
    MegaValidator.modules[name] = moduleFunction;
}

/**
 * Маппер валидаторов для jQuery
 * @type {Object}
 */
MegaValidator.jQueryMapper = {
    minlength: 'minLength',
    maxlength: 'maxLength',
    min: 'minValue',
    max: 'maxValue',
    equalTo: ['equalsTo', {'dependsField': 'values[0]'}]
}

/**
 * Основная функция валидации. Валидирует объект.
 * @param  {object} object        Объект валидации
 * @param  {object} validatorMaps Маппер валидации
 * @param  {boolean} forceReturn   Если false - вернёт true, если не было ошибок. Если true - в любом случае вернёт результат валидации в виде объекта.
 * @return {object|boolean}               Исход боя
 */
MegaValidator.validate = function(object, validatorMaps, forceReturn) {

    if (typeof forceReturn == 'undefined') {
        forceReturn = false;
    }

    if ('validators' in validatorMaps) { // вроде как к объекту применяют кусок объекта валидации
        object = {
            object: object
        };
        validatorMaps = {
            object: validatorMaps
        }
        var errors = MegaValidator.validateField(object, 'object', validatorMaps['object'], validatorMaps, forceReturn);
        MegaValidator.lastResult = errors;
        MegaValidator.lastObject = object;
        return (!forceReturn && $.isEmptyObject(errors)) ? true : errors.errors;
    }

    if (!object) {
        throw new Error('Nothing to validate :(');
    }
    var errors = {};
    for (var fieldName in validatorMaps) {
        var item = validatorMaps[fieldName];

        var fieldErrors = MegaValidator.validateField(object, fieldName, item, validatorMaps, forceReturn);

        if (forceReturn || fieldErrors !== true) {
            errors[fieldName] = fieldErrors;
        }
    }

    MegaValidator.lastResult = errors;
    MegaValidator.lastObject = object;

    return (!forceReturn && $.isEmptyObject(errors)) ? true : errors;
}

/**
 * Валидация формы
 * @param  {DOM|jQuery object} form          Форма - объект валидации
 * @param  {object} validatorMaps Маппер валидации
 * @param  {object} events        Объект с перечисление евентов
 * @param  {object|null} object        Объект, в который наберутся значения полей формы
 * @return {object}               Результат валидации
 */
MegaValidator.validateForm = function(form, validatorMaps, events, object) {
    var validatorMapsCopy = $.extend(true, {}, validatorMaps),
        $form = $(form);

    $('[name]', form).each(function() {
        var name = $(this).attr('name');
            regExp = new RegExp('^' + MegaValidator.escapeRegExp($form.attr('name')) + '\\[(.+)\\]$'),
            res = regExp.exec(name);

        if ($form.attr('name') && res) {
            name = res[1];
        }
        if ( name && ! (name in validatorMapsCopy)) {
            validatorMapsCopy[name] = [];
        }
    });

    for (var field in validatorMapsCopy) {
        if (!(jQuery.isPlainObject(validatorMapsCopy[field]) && ('validators' in validatorMapsCopy[field]))) {
            validatorMapsCopy[field] = {
                validators: validatorMapsCopy[field]
            };
        }
        if (validatorMapsCopy[field].target !== null) {
            validatorMapsCopy[field].target = true;
        }
        if (validatorMapsCopy[field].form !== null) {
            validatorMapsCopy[field].form = form;
        }
        if (validatorMapsCopy[field].valueFromTarget !== null) {
            validatorMapsCopy[field].valueFromTarget = true;
        }
    }

    var res = MegaValidator.validate(object === null ? {} : object, validatorMapsCopy, true);
    var isValid = MegaValidator.isValidResult(res);

    if (events !== null && 'errorPlacement' in events) {
        for (var field in res) {
            if (!jQuery.isEmptyObject(res[field].errors)) {
                for (var error in res[field].errors) {
                    events.errorPlacement(res[field].errors[error], res[field].target);
                    break;
                }
            } else {
                events.errorPlacement('', res[field].target);
            }
        }
    }
    if (events !== null && 'success' in events && isValid) {
        for (var field in res) {
            events.success(res[field].target);
        }
    }
    return res;
}

/**
 * Проверка результата валидации (например результат validate, в который передан forceResult = true) на наличие ошибок
 * @param  {object}  validationResult Результат валидации
 * @return {Boolean}                  Валидность результата
 */
MegaValidator.isValidResult = function(validationResult) {
    if (validationResult === true) {
        return true;
    }
    if ('errors' in validationResult) {
        validationResult = validationResult.errors;
    }
    for (var field in validationResult) {
        if (jQuery.isPlainObject(validationResult[field])) {
            if ('errors' in validationResult[field] && !jQuery.isEmptyObject(validationResult[field].errors)) {
                return false;
            }
        } else
            return false;
    }
    return true;
}

/**
 * Проверка формы на валидность
 * @param  {DOM|jQuery object}  form          Форма - объект валидации
 * @param  {object}  validatorMaps Маппер валидации
 * @param  {object}  events        Объект с колбэками на евенты
 * @param  {object}  object        Объект, в который соберуться поля формы
 * @return {Boolean}               Валидность формы
 */
MegaValidator.isValidForm = function(form, validatorMaps, events, object) {
    return MegaValidator.isValidResult(MegaValidator.validateForm(form, validatorMaps, events, object));
}

/**
 * Проверка объекта на валидность
 * @param  {object}  object        Объект валидации
 * @param  {object}  validatorMaps Маппер валидации
 * @return {Boolean}               Валидность объекта
 */
MegaValidator.isValid = function(object, validatorMaps) {
    return MegaValidator.validate(object, validatorMaps) === true;
}

/**
 * Это пиздец, а не фунция. не читай. Она просто переводит (должна по крайней мере)
 * переводить jQuery валидатор в нужный вид для MegaValidator'а.
 * @param  {jQueryValidator} jQueryValidatorMaps Валидатор для jquery
 * @return {MegaValidator.validatorMaps}        Маппер валидации для использования в функции MegaValidator.validate
 */
MegaValidator.validatorMapsFromJQuery = function(jQueryValidatorMaps) {
    var validatorMaps = {};
    for (var field in jQueryValidatorMaps.rules) {
        validatorMaps[field] = {
            validators: $.extend(true, {}, jQueryValidatorMaps.rules[field])
        };

        for (var v in validatorMaps[field].validators) {
            values = jQuery.isArray(validatorMaps[field].validators[v]) ? validatorMaps[field].validators[v] : [validatorMaps[field].validators[v]];

            if (v in MegaValidator.jQueryMapper) {
                newField = MegaValidator.jQueryMapper[v];
                newValues = values;

                if (jQuery.isArray(MegaValidator.jQueryMapper[v])) {
                    newField = MegaValidator.jQueryMapper[v][0];
                    newValues = jQuery.isArray(MegaValidator.jQueryMapper[v][1]) ? MegaValidator.jQueryMapper[v][1] : [MegaValidator.jQueryMapper[v][1]];
                    for (var value in newValues) {
                        if (jQuery.isPlainObject(newValues[value])) {
                            for (var _value in newValues[value]) {
                                newValues[value][_value] = eval(newValues[value][_value]);
                            }
                        } else {
                            newValues[value] = values[value];
                        }
                    }
                }

                validatorMaps[field].validators[newField] = {
                    values: newValues
                };
                delete validatorMaps[field].validators[v];
            } else {
                validatorMaps[field].validators[v] = {
                    values: values
                };
            }
        }
    }

    for (var field in jQueryValidatorMaps.messages) {
        if (field in jQueryValidatorMaps.rules) {
            for (var v in jQueryValidatorMaps.messages[field]) {
                if (v in jQueryValidatorMaps.rules[field]) {
                    if (v in MegaValidator.jQueryMapper) {
                        var newField = jQuery.isArray(MegaValidator.jQueryMapper[v]) ? MegaValidator.jQueryMapper[v][0] : MegaValidator.jQueryMapper[v];
                        validatorMaps[field].validators[newField].message = jQueryValidatorMaps.messages[field][v];
                    } else {
                        validatorMaps[field].validators[v].message = jQueryValidatorMaps.messages[field][v];
                    }
                }
            }
        }
    }
    return validatorMaps;
}

/**
 * Валидация одного поля объекта
 *
 * @param  {Object} object       Объект - обладатель валидируемого поля
 * @param  {string} fieldName    Имя валидируемого поля
 * @param  {object} validatorMap Опции валидации одного поля
 * @param  {boolean}  forceReturn Если true, вернёт результат валидации, даже если не было ошибок
 *
 * @return {mixed}              Если forceReturn - false, вернёт true или ошибки
 */
MegaValidator.validateField = function(object, fieldName, validatorMap, validatorMaps, forceReturn) {
    var errors = {};


    validatorMap = MegaValidator.normalizeValidatorMap(validatorMap);

    // !!! теперь у нас как минимум есть объект со свойством-объектом - validators,
    // где поля - это имена валидаторов
    // if (jQuery.isEmptyObject( validatorMap.validators )) {
    //     return true;
    // }

    var additionalInfo = MegaValidator.applyModules( object, fieldName, validatorMap );

    for (var validatorName in validatorMap.validators) {
        // если валидатор не required, значение налл и это разрешено, то значение считается валидным
        if ($.inArray(validatorName, MegaValidator.requiredValidators) == -1 && MegaValidator.maybeNull(object[fieldName])) {
            continue;
        }

        var validatorOptions = validatorMap.validators[validatorName];

        var values = MegaValidator.getValues(object, validatorOptions);

        // валидация зависимых полей
        var ok = true;
        for (var i in values) {
            if (jQuery.isPlainObject(values[i]) && 'dependsField' in values[i]) {
                var depFieldName = values[i].dependsField;
                var fieldErrors = MegaValidator.validateField(object, depFieldName, validatorMaps[depFieldName], validatorMaps);

                if (fieldErrors === true) {
                    values[i] = object[depFieldName];
                } else {
                    ok = false;
                    break;
                }
            }
        }

        if (!ok) {
            continue;

        }

        var result = MegaValidator.executeValidator( object[fieldName], validatorName, values );

        // наконец, валидируем, ребята
        if (result !== MegaValidator.getExpectedResult( object, validatorName, validatorOptions, values )) {
            errors[validatorName] = MegaValidator.getMessage( object, validatorName, validatorOptions, values );
        }
    }

    for (var adInfo in additionalInfo) {
        if (jQuery.isPlainObject(additionalInfo[adInfo]) && 'errors' in additionalInfo[adInfo]) { // модули тоже могут возвращать ошибки
            errors = $.extend(errors, additionalInfo[adInfo].errors);
        }
    }

    return (!forceReturn && jQuery.isEmptyObject(errors)) ? true : $.extend({
                errors: errors
            }, additionalInfo);
}

/**
 * Запускает переданный валидатор для переданного значения
 * @param  {похеру} field     Валидируемое значение
 * @param  {string} validator Имя валидатора
 * @param  {array} values    Параметры валидатора
 * @return {boolean}           Результат валидации
 */
MegaValidator.executeValidator = function(field, validator, values) {
    if (!(validator in MegaValidator.validators) || !$.isFunction(MegaValidator.validators[validator])) {
        throw new Error('Unknown validator "' + validator + '"');
    }

    values = values.slice();

    values.unshift(field);
    return MegaValidator.validators[validator].apply(null, values);
}

/**
 * Преобразует настройки валидации в один вид - объект с полем validators - тоже объект с полями-валидаторами
 *
 * @param  {mixed} validatorMap Настройки валидации
 *
 * @return {object}              Нормализованный мап валидации
 */
MegaValidator.normalizeValidatorMap = function(validatorMap) {
    // если что тут мы добиваем маппер валидации до одной определённой формы

    // просто массив валидаторов или объект с валидаторами
    if (!$.isPlainObject(validatorMap) || !('validators' in validatorMap)) {
        validatorMap = {
            validators: validatorMap
        }
    }

    validatorMap = jQuery.extend(true, {}, validatorMap);

    if (typeof validatorMap.validators == 'string') { // 1 валидатор? хуле
        validatorMap.validators = [validatorMap.validators];
    }

    // переводим validators в объект если что
    if ($.isArray(validatorMap.validators)) {
        var temp = validatorMap.validators.slice();
        validatorMap.validators = {};
        for (var i = 0; i < temp.length; i++) {
            var validatorName = temp[i];
            validatorMap.validators[validatorName] = true;
        }
    }

    return validatorMap;
}

/**
 * Применение модулей к объекту
 *
 * @param  {object} object       Валидируемый объект
 * @param  {string} fieldName    Валидируемое поле
 * @param  {object} validatorMap Объект, описывающий валидацию поля
 *
 * @return {object}              Результаты каждого модуля
 */
MegaValidator.applyModules = function(object, fieldName, validatorMap) {
    var additionalInfo = {};

    // остальная хуйня - это (ВНИМАНИЕ!) ..... "МОДУЛИ" блять
    for (var moduleName in validatorMap) {
        if (moduleName in MegaValidator.modules) {
            var res = MegaValidator.modules[moduleName].apply(validatorMap, [object, fieldName]);
            if (res !== null) {
                additionalInfo[moduleName] = res;
            }
        }
    }

    return additionalInfo;
}

/**
 * Достаёт значения, используемые для валидации
 *
 * @param  {object} object           Объект валидации
 * @param  {mixed} validatorOptions Мап валидации одного поля
 *
 * @return {array}
 */
MegaValidator.getValues = function(object, validatorOptions) {

    // подставляем значения
    var values = [];
    if (jQuery.isPlainObject(validatorOptions) && ('values' in validatorOptions)) {
        values = validatorOptions.values;
    } else if (!jQuery.isPlainObject(validatorOptions) && typeof validatorOptions != 'string' && typeof validatorOptions != 'boolean') {
        values = validatorOptions;
    }

    if (!jQuery.isArray(values)) {
        values = [values];
    }

    for (var i in values) { // если что рубим функции
        if (jQuery.isFunction(values[i])) {
            values[i] = values[i].apply(object);
        }
    }

    return values;
}

/**
 * Возвращает сообщение об ошибке для определённого валидатора
 *
 * @param  {object} object    Валидируемый объект
 * @param  {string} validatorName    Имя валидатора
 * @param  {mixed} validatorOptions Мап валидации одного поля
 * @param  {array} values    Параметры валидатора
 *
 * @return {string}                  Сообщение
 */
MegaValidator.getMessage = function(object, validatorName, validatorOptions, values) {
    // разбираем сообщение
    var message = MegaValidator.defaultMessages[validatorName];

    if (typeof validatorOptions == 'string') { // имя прямо тут
        message = validatorOptions;
    } else if (jQuery.isPlainObject(validatorOptions) && ('message' in validatorOptions)) { // поле message
        message = validatorOptions.message;
    }
    if (jQuery.isFunction(message)) {
        message = message.apply(object, values);
    }

    // @dirtyHack хм
    var formatString = function(string, values) {
        var args = jQuery.isArray(values) ? values : arguments.slice(1);

        return string.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] != 'undefined'
              ? args[number]
              : match
            ;
          });
    }

    return message ? formatString(message, values) : 'Error';
}

/**
 * Возвращает значение, которое должен вернуть валидатор в случае валидности значения.
 *
 * @param  {object} object    Валидируемый объект
 * @param  {string} validatorName    Имя валидатора
 * @param  {mixed} validatorOptions Мап валидации одного поля
 * @param  {array} values    Параметры валидатора
 *
 * @return {mixed}
 */
MegaValidator.getExpectedResult = function(object, validatorName, validatorOptions, values) {
    // значение - которое должен вернуть валидатор (типа правильное значение)
    var expectedResult = true;

    if (typeof validatorOptions == 'boolean') {
        expectedResult = validatorOptions;
    } else if (jQuery.isPlainObject(validatorOptions) && ('expectedResult' in validatorOptions)) {
        expectedResult = validatorOptions.expectedResult;
    }
    if (jQuery.isFunction(expectedResult)) {
        expectedResult = expectedResult.apply(object, values);
    }

    return expectedResult;
}

MegaValidator.regexes = {
    digits: /^[0-9]+$/i,
    url: /^(http|https):\/\/(([a-zа-яё0-9-]+\.)+([a-zа-яё0-9]{2,})(\/.*)?)$/i,
    shortURL: /^((http|https):\/\/)?(([a-zа-яё0-9-]+\.)+([a-zа-яё0-9]{2,})(\/.*)?)$/i,
    email: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i,
    textString: /^[а-яёҐґЄєІіЇї–\w\d\s\$\-\#\№\;\:\"\_\.\+\!\*\?\'\\\/\[\]\>\<\%\@\^\&\=\~\(\)\,]*$/i,
    'float': /^[+-]?(\d+)([\.\,]\d+)?$/i,
    'int': /^[+-]?\d+$/i,
    phone: /^((8|\+38)-?)?(\(?\d{3}\)?)?-?\d{3}-?\d{2}-?\d{2}$/,
};

/**
 * @source http://stackoverflow.com/a/6969486
 */
MegaValidator.escapeRegExp = function(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
};

 MegaValidator.getRegExp = function(key) {
    return new RegExp(MegaValidator.regexes[key]);
};

/**
 * Список валидаторов
 * @type {Object}
 */
MegaValidator.validators = {
    required: function(value) { return value !== null && value !== '' && value !== undefined; },
    minLength: function(value, minLength) { return (value ? value.toString().length >= minLength : true); },
    maxLength: function(value, maxLength) { return (value ? value.toString().length <= maxLength : true); },
    lengthInRange: function(value, min, max) { return (value ? (value.length >= min && value.length <= max) : true); },
    digits: function(value) { return MegaValidator.getRegExp('digits').test(value); },
    'float': function(value) {
        return MegaValidator.getRegExp('float').test(value);
    },
    'int': function(value) { return MegaValidator.getRegExp('int').test(value); },
    greaterThan: function(value, value2) { return value > value2; },
    lessThan: function(value, value2) { return value < value2; },
    maxValue: function(value, value2) {  return value <= value2; },
    minValue: function(value, value2) { return value >= value2; },
    betweenValues: function(value, min, max) { return (value >= min && value <= max); },
    // получается, либо просто значение, либо jQuery объект, либо что еще? я хочу поле текущего объекта
    equalsTo: function(value, value2) { return value == value2; },
    notEqualsTo: function(value, value2) { return value != value2; },
    equalsToField: function(value, value2) { return value == value2; },
    notEqualsToField: function(value, value2) { return value != value2; },
    object: function(value) { return jQuery.isPlainObject(value); },
    notEmptyObject: function(value) { return !jQuery.isEmptyObject(value); },
    url: function(value) { return MegaValidator.getRegExp('url').test(value); },
    shortURL: function(value) { return MegaValidator.getRegExp('shortURL').test(value); },
    validTextString: function(value) { return MegaValidator.getRegExp('textString').test(value); },
    requiredOnlyIf: function(value, cond) { return !cond || !MegaValidator.isNull(value); },
    email: function(value) { return MegaValidator.getRegExp('email').test(value) },
    phone: function(value) { return MegaValidator.getRegExp('phone').test(value) },
    range: function(value) { return (_.isArray(value) && (value[0] == 0 || value[1] == 0 || value[1] >= value[0])); },
    customFunction: function(value, func) { return (jQuery.isFunction(func) && func.apply(null, [value])); },
}

MegaValidator.requiredValidators = ['required', 'requiredOnlyIf'];

/**
 * Дефолтные сообщения об ощибках
 * @type {Object}
 */
MegaValidator.defaultMessages = {
    required: "This field is required.",
    requiredOnlyIf: "The field is required",
    minLength: "Please enter at least {0} characters.",
    maxLength: "Please enter no more than {0} characters.",
    digits: "Please enter a valid number.",
    'float': "Please enter a valid float number.",
    'int': "Please enter a valid integer number.",
    greaterThan: "Please enter a value greater than {0}.",
    lessThan: "Please enter a value less than {0}.",
    maxValue: "Please enter a value less than or equal to {0}.",
    minValue: "Please enter a value greater than or equal to {0}.",
    equalsTo: "Please enter a value equal to {0}.",
    equalsToField: "Please enter a value equal to '{0}' field.",
    notEqualsTo: "Please enter a value not equal to {0}.",
    notEqualsToField: "Please enter a value not equal to '{0}' field.",
    lengthInRange: "Please enter a string with length between {0} and {1}",
    betweenValues: "Value must be between {0} and {1}",
    range: "Please enter a valid range",
    object: "Please enter a valid javascript object.",
    notEmptyObject: "Please enter a valid and not empty javascript object.",
    url: "Please enter a valid URL.",
    shortURL: "Please enter a valid URL.",
    validTextString: "Please do not use invalid characters.",
    email: "Please enter a valid email address.",
    phone: 'Please enter a valid phone number',
    customFunction: "OH! Something you entered is wrong..."
}

/**
 * Список модулей.
 *  Модули - поля, которые передаются вместе с валидаторами.
 *  Работают только, если в маппер валидации валидаторы передавать в поле validators
 *
 * @type {Object}
 */
MegaValidator.modules = {
    // this = кусок валидатора (значение поля в маппе валидации)
    // то, у чего есть свойство-название модуля
    target: function(object, fieldName) {
        // @dirtyHack почему? почему здесь изменяется this.target ?? это же сам мап валидации 0_Щ,
        if (this.target === true) {
            // Если у формы есть аттрибут name, то и все её инпуты должны быть как <form_name>[<name>]
            if (this.form && $(this.form).attr('name')) {
                fieldName = $(this.form).attr('name') + "[" + fieldName + "]";
            }
            this.target = this.form ? $('[name="' + fieldName + '"]', this.form) : $('[name="' + fieldName + '"]');
            if (this.target.attr('type') == 'radio') {
                this.target = this.form ? $('[name="' + fieldName + '"]:checked', this.form) : $('[name="' + fieldName + '"]:checked');
            }
        } else if (jQuery.isFunction(this.target)) {
            this.target = this.target.apply(object);
        } else if (typeof this.target === 'string') {
            this.target = $(this.target);
        }
        return this.target;
    },
    // какой-то очкень jQuery модуль
    valueFromTarget: function(object, fieldName) { // вдруг нужно вытащить из таргета значение

        var validateMap = this;
        if (validateMap.valueFromTarget === false) {
            return;
        }

        var val = null;
        if (validateMap.valueFromTarget === true) { // просто берём value из таргета
            if (!('target' in validateMap)) {
                throw new Error('Where is your target? oO');
            }
            val = validateMap.target.val(); // @dirtyHack а здесь? почему здесь параметр валидации используется как jquery объект???
        } else {
            if (!$.isFunction(validateMap)) {
                throw new Error('WTF is "' + validateMap.valueFromTarget + '"');
            }

            val = validateMap.valueFromTarget[0].call(validateMap.target);
        }

        return object[fieldName] = val;
    },
    trimValue: function(object, fieldName) {
        return object[fieldName] = jQuery.trim(object[fieldName]);
    },
    title: function(object, fieldName) {
        return this.title;
    },
    objectValidator: function(object, fieldName) {
        if (!MegaValidator.strictlyConditions && object[fieldName] == null) {
            return null;
        }

        var objectErrors = MegaValidator.validate(object[fieldName], this.objectValidator),
            errors = {};
        // for (var i in objectErrors)
        // {
        //  errors = $.extend(errors, objectErrors[i].errors);
        // }
        // return jQuery.isEmptyObject(errors) ? null : { errors: errors };
        return objectErrors === true ? null : { errors: objectErrors };
    },
    'int': function(object, fieldName) {
        if (this['int'] === true && MegaValidator.getRegExp('int').test(object[fieldName])) {
            return object[fieldName] = parseInt(object[fieldName]);
        }
        // return NaN;
    },

    'float': function(object, fieldName) {
        if (this['float'] === true && MegaValidator.getRegExp('float').test(object[fieldName])) {
            return object[fieldName] = parseFloat(object[fieldName]);
        }
        // return NaN;
    },

    roundedFloat: function(object, fieldName) {
        // console.log(object[fieldName], MegaValidator.getRegExp('float').test(object[fieldName]));
        // if (!MegaValidator.getRegExp('float').test(object[fieldName]))
        //  return NaN;
        if (this.roundedFloat === true) {
            return object[fieldName] = parseFloat(object[fieldName]);
        } else if (this['float'] !== false) {
            return object[fieldName] = round(parseFloat(object[fieldName]), this.roundedFloat);
        }
    },

    defaultValue: function(object, fieldName) {
        if (object[fieldName] == null) {
            object[fieldName] = this.defaultValue;
        }
    },

    unixTime: function(object, fieldName) {
        if (this.unixTime !== false && object[fieldName] != null) {
            var date = null;
            if (date == null && $ != null && 'datepicker' in $) {
                var format = 'dd-mm-yy hh:mm';
                if (typeof this.unixTime === 'string') {
                    format = this.unixTime;
                }
                format = format.split(' ');

                if ($.isArray(this.unixTime)) {
                    format = this.unixTime;
                }

                if ($.isPlainObject(this.unixTime) && 'dateFormat' in this.unixTime && 'timeFormat' in this.unixTime) {
                    format = this.unixTime;
                } else {
                    format = {
                        dateFormat: format[0],
                        timeFormat: format[1]
                    }
                }

                // <пиздатый парсинг дэйттайма>
                var $div = $('<div>');
                try {
                    $div.datetimepicker(format);
                    $div.datetimepicker('setDate', object[fieldName]);
                    console.log(format, object[fieldName], $div.datetimepicker('getDate'));
                    date = $div.datetimepicker('getDate');//$.datepicker.parseDate(typeof this.unixTime === 'string' ? this.unixtime : "dd-mm-yy", object[fieldName])
                } catch (e) {
                    console.error('Видно неправильный формат:', format, object[fieldName]);
                }
                // </пиздатый парсинг дэйттайма>

            }
            if (date == null) {
                date = Date.parse(object[fieldName]);
            }
            if (date != null && date instanceof Date) {
                return object[fieldName] = date.getTime() / 1000;
            }
        }
    },

    customFunction: function(object, fieldName) {
        if (jQuery.isFunction(this.customFunction)) {
            object[fieldName] = this.customFunction.apply(object);
        }
    },

}