MegaValidator
=============

JS Validator for objects (can be used for forms)

Tutorial (rus)
-------------

Для валидации используется метод validate, в который первым параметром передается валидируемый объект, а вторым - т.н. мап валидации, т.е. набор настроек валидации.

Мап валидации выглядит примерно так:
	
	var m = {
		field1: [
			'required', 'email'
		],
		field1_25: {
			required: 'Fuck',
			email: 'You',
			float: false,
			validTextString: true
		},
		field1_5: {
			validators: [
				'required', 'email'
			],
			target: $('[name=email]'),
			valueFromTarget: true,
			focus: true
		},
		field2: {
			validators: {
				required: 'Поле должно быть вот ТАКИМ ВОТ не пустым',
				email: {
					message: 'Мылом должно быть это поле',
				},
				int: true, // дефолтное сообщение
				float: false, // не надо нам флоат
				maxLength: {
					values: 30,
					message: 'Максимальная длина - {0}'
				},
				range: {
					values: [3, 60],
					message: 'Длина должна быть между {0} и {1}'
				},
				equalsTo: {
					values: {dependsField: "fieldName"}
				},
			},
			// "модули"
			target: $('[name=email]') // куда если что фокусить,
			valueFromTarget: true // из таргета достанет
			valueFromTarget: $('[name=email]').html // val, text
			valueFromTarget: [$('[name=email]').attr, 'data-value']
			valueFromTarget: function() {return round($('[name=email]').attr('data-value'), 2);},
			valueFromTarget: function() {return round($(this).attr('data-value'), 2);},
		}
	};

Результатом валидации в случае невалидности объекта будет объект вида:

	{
		field: {
			errors: {
				validatorName: *message*,
				validatorName2: *message*
			}
		},
		field2: {
			validatorName: *message*,
		}
	}

либо функция вернёт true, в противном случае.

Также в функцию третьим параметром можно передать true, тогда вовзращаемый результат в обоих случаях будет объект.

Расширение функциональности
-------------

Функциональность валидатора расширяется путём добавления своих валидаторов, а также использование и добавления т.н. модулей.

### Добавление своих валидаторов ###

Добавление новых валидаторов возможно с помощью функции метода addValidator. Параметры функции:
* name - имя валидатора
* validFunction - колбэк (сама валидация)
* defaultMessage - сообщение об ошибке по умолчанию
* required - указывает ли валидировать значение, даже если значение пустое

Первым парамером колбэка валидатора при вызове будет валидируемое значение (поле объекта), а всеми остальными - значения валидатора (минимальная длина, промежуток в виде 2-х чисел (будет 2 параметра, если в поле values передать массив из 2-х чисел)).
Возвращаемое значение должно быть boolean в общих случаях, но вообще оно должно соотвествовать expectedResult.

### "Модули" ###

Т.н. модули используются для добавления функциональности валидации, либо добавления дополнительной информации в выходной объект.

#### Описание ####

Модуль для валидатора - это функция, которая принимает первым аргументом валидируемый объект, а вторым имя валидируемого в данный момент поля. Также в this внутри самой функции-модуле будет мап валидации текущего поля, т.е. кусок всего мапа валидации.

Для примера разберём модуль target, этот модуль позволяет привязать поле объекта с элементом на странице. В самом мапе валидации в нужном поле добавляем поле target, значением которого могут быть:
* true - тогда "таргетом" будет элемент с атрибутом name равным именю поля.
* строка - используется как селектор элемента
* функция - результат выполнения функции (вместо this в неё будет подставлен весь валидируемый объект)

В функции-модуле значение берётся с помощью this.target, таким образом модули могут использовать друг друга, например, при target = true и заданном значении модуля form в мапе валидации, элемент с атрибутом name будет искаться в пределах элемента, представленного this.form.
Также модули можно использовать для изменения полей объекта, т.е. использовать как фильтры.

Результат работы каждого модуля вернётся в результате валидации (на равне с полем errors)

#### Добавление новых ####

Добавление новых модулей производится с помощью метода addModule, в который передаётся имя модуля и функция-колбэк. Параметры функции и её поведение описаны выше.

Пример использования
-------------

	var obj = {
		'int': '+12',
		'string': 'asd',
		object: {
			successField: 20,
			failureField: '-12',
		},
	}, valMap = {
		'int': 'int',
		'string': {
			'minLength': 2,
		},
		object: {
			validators: 'object',
			objectValidator: {
				successField: {
					validators: {
						maxValue: 20,
					},
					title: 'Заголовок',
				},
				failureField: {
					validators: {
						minValue: {
							values: 0,
							message: 'Минимальное значение - {0}',
						},
						'int': {
							expectedResult: false,
							message: 'Не вводите мне тут числа',
						},
						maxLength: {values: -100500},
						maxValue: {
							values: -Math.random() * 100500 - 100,
							message: 'Максимальное значение - {0}'
						},
						object: true,
						minLength: {
							values: function() { return Math.random() * 100500 + 100500; },
							message: 'Тут рандомное число - {0}',
						},
					},
				},
			},
		},
	}, res = MegaValidator.validate(obj, valMap, true);

	console.log('Валидируем - ', obj);
	console.log('С вот такими настройками - ', valMap);
	console.log('А вот и результат - ', res);
	console.log('Валиден ли результат?', MegaValidator.isValidResult(res));

Дополнительно
-------------

Также есть некоторый функционал, о котором можно узнать и который можно понять, прочитав пример, исходный код, зная, что ищешь, или спросив у меня. Дойдут руки, опишу, а пока я просто его перечислю: использование "ожидаемого значения", описание всех моделей, изменение ошибок с использование моделей, зависимые поля, возможные синтаксисы мапа валидации...