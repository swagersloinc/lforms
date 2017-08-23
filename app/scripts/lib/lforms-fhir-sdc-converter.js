if (typeof LForms === 'undefined')
  LForms = {};

if (typeof LForms.FHIR_SDC === 'undefined')
  LForms.FHIR_SDC = {};

(function(ns) {
"use strict";

  var self = ns;
  // FHIR extension urls
  self.fhirExtUrlCardinalityMin = "http://hl7.org/fhir/StructureDefinition/questionnaire-minOccurs";
  self.fhirExtUrlCardinalityMax = "http://hl7.org/fhir/StructureDefinition/questionnaire-maxOccurs";
  self.fhirExtUrlItemControl = "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl";
  self.fhirExtUrlUnit = "http://hl7.org/fhir/StructureDefinition/questionnaire-unit";
  self.fhirExtUrlAllowedUnits = "http://hl7.org/fhir/StructureDefinition/elementdefinition-allowedUnits";
  self.fhirExtUrlCodingInstructions = "http://hl7.org/fhir/StructureDefinition/questionnaire-displayCategory";
  self.fhirExtUrlOptionPrefix = "http://hl7.org/fhir/StructureDefinition/questionnaire-optionPrefix";
  self.fhirExtUrlOptionScore = "http://hl7.org/fhir/StructureDefinition/questionnaire-optionScore";
  self.fhirExtUrlRestrictionArray = [
    "http://hl7.org/fhir/StructureDefinition/minValue",
    "http://hl7.org/fhir/StructureDefinition/maxValue",
    "http://hl7.org/fhir/StructureDefinition/minLength",
    "http://hl7.org/fhir/StructureDefinition/regex"
  ];


  /**
   * Convert FHIR SQC Questionnaire to LForms definition
   *
   * @param fhirData - FHIR Questionnaire object
   * @returns {{}} - LForms json object
   */
  self.convertQuestionnaire2Lforms = function (fhirData) {
    var target = null;

    if(fhirData) {
      target = {};
      _processFormLevelFields(fhirData, target);

      if(fhirData.item && fhirData.item.length > 0) {
        target.items = [];
        for( var i = 0; i < fhirData.item.length; i++) {
          var item = self._processQuestionnaireItem(fhirData.item[i], fhirData);
          target.items.push(item);
        }
      }
    }

    return target;
  };


  /**
   * Parse form level fields from FHIR questionnaire and assign to LForms object.
   *
   * @param questionnaire - FHIR questionnaire resource object to parse for the fields.
   * @param lfData - LForms object to assign the extracted fields
   * @private
   */
  function _processFormLevelFields(questionnaire, lfData) {
    lfData.name = questionnaire.title;
    var code = _getCode(questionnaire);
    if(code) {
      lfData.code = code.code;
      lfData.codeSystem = code.system;
    }
  }


  /**
   * Process questionnaire item recursively
   *
   * @param qItem - item object as defined in FHIR Questionnaire.
   * @param qResource - The source object of FHIR  questionnaire resource to which the qItem belongs to.
   * @returns {{}} - Converted 'item' field object as defined by LForms definition.
   * @private
   */
  self._processQuestionnaireItem = function (qItem, qResource) {
    var targetItem = {};
    targetItem.question = qItem.text;
    //A lot of parsing depends on data type. Extract it first.
    _processDataType(targetItem, qItem);
    _processCode(targetItem, qItem);
    _processEditable(targetItem, qItem);
    _processQuestionCardinality(targetItem, qItem);
    _processAnswerCardinality(targetItem, qItem);
    _processDisplayControl(targetItem, qItem);
    _processRestrictions(targetItem, qItem);
    _processUnit(targetItem, qItem);
    _processCodingInstructions(targetItem, qItem);
    _processUnitList(targetItem, qItem);
    _processDefaultAnswer(targetItem, qItem);
    _processAnswers(targetItem, qItem);
    _processSkipLogic(targetItem, qItem, qResource);

    if (Array.isArray(qItem.item)) {
      targetItem.items = [];
      for (var i=0; i < qItem.item.length; i++) {
        var newItem = self._processQuestionnaireItem(qItem.item[i], qResource);
        targetItem.items.push(newItem);
      }
    }

    return targetItem;
  };


  /**
   * Parse questionnaire object for answer cardinality
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processAnswerCardinality(lfItem, qItem) {
    if(qItem.required) {
      lfItem.answerCardinality = {min: '1'};
    }
  }


  /**
   * Parse questionnaire object for skip logic information
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @param sourceQuestionnaire - Questionnaire resource object. This is to provide top level
   *                              item to navigate the tree for skip logic source items.
   * @private
   */
  function _processSkipLogic(lfItem, qItem, sourceQuestionnaire) {
    if(qItem.enableWhen) {
      lfItem.skipLogic = {conditions: []};
      for(var i = 0; i < qItem.enableWhen.length; i++) {
        var source = null;
        for(var n = 0; !source && n < sourceQuestionnaire.item.length; n++) {
          source = _getSourceCodeUsingQuestionText(sourceQuestionnaire.item[n], qItem.enableWhen[i].question);
        }
        var condition = {source: source.questionCode};
        var answer = _getValueWithPrefixKey(qItem.enableWhen[i], /^answer/);
        if(source.dataType === 'CWE' || source.dataType === 'CNE') {
          condition.trigger = {code: answer.code};
        }
        else {
          condition.trigger = {value: answer};
        }
        lfItem.skipLogic.conditions.push(condition);
      }
    }
  }


  /**
   * Parse questionnaire item for answers list
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processAnswers(lfItem, qItem) {
    if(qItem.option) {
      lfItem.answers = [];
      for(var i = 0; i < qItem.option.length; i++) {
        var answer = {};
        var label = LForms.Util.findObjectInArray(qItem.option[i].extension, 'url', self.fhirExtUrlOptionPrefix);
        if(label) {
          answer.label = label.valueString;
        }
        var score = LForms.Util.findObjectInArray(qItem.option[i].modifierExtension, 'url', self.fhirExtUrlOptionScore);
        if(score) {
          answer.score = score.valueInteger.toString();
        }
        answer.code = qItem.option[i].valueCoding.code;
        answer.text = qItem.option[i].valueCoding.display;
        lfItem.answers.push(answer);
      }
    }
  }


  /**
   * Parse questionnaire item for editable
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processEditable(lfItem, qItem) {
    if (qItem.readonly) {
      lfItem.editable = '0';
    }
  }


  /**
   * Parse questionnaire item for default answer
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processDefaultAnswer(lfItem, qItem) {

    var val = _getValueWithPrefixKey(qItem, /^initial/);
    if (val) {
      if (lfItem.dataType === 'CWE' || lfItem.dataType === 'CNE' ) {
        if (qItem.repeats) {
          lfItem.value = [{code: val.code, text: val.display}];
          lfItem.defaultAnswer = [{code: val.code, text: val.display}];
        }
        // single selection, item.value is an object
        else {
          lfItem.value = {code: val.code, text: val.display};
          lfItem.defaultAnswer = {code: val.code, text: val.display};
        }
      }
      else {
        lfItem.value = val;
        lfItem.defaultAnswer = val;
      }
    }
  }


  /**
   * Parse questionnaire item for units list
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processUnitList(lfItem, qItem) {
    var units = LForms.Util.findObjectInArray(qItem.extension, 'url', self.fhirExtUrlAllowedUnits);
    if(units && units.valueCodeableConcept && Array.isArray(units.valueCodeableConcept.coding)) {
      lfItem.units = [];
      for(var i = 0; i < units.valueCodeableConcept.coding.length; i++) {
        var unit = units.valueCodeableConcept.coding[i];
        lfItem.units.push({name: unit.code});
      }
    }
  }


  /**
   * Parse questionnaire item for question cardinality
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processQuestionCardinality(lfItem, qItem) {
    var min = LForms.Util.findObjectInArray(qItem.extension, 'url', self.fhirExtUrlCardinalityMin);
    if(min) {
      lfItem.questionCardinality = {min: min.valueInteger.toString()};
      var max = LForms.Util.findObjectInArray(qItem.extension, 'url', self.fhirExtUrlCardinalityMax);
      if(max) {
        lfItem.questionCardinality.max = min.valueInteger.toString();
      }
      else if(qItem.repeats) {
        lfItem.questionCardinality.max = '*';
      }
    }
    else if (qItem.repeats) {
      lfItem.questionCardinality = {min: "1", max: "*"};
    }
    else if (qItem.required) {
      lfItem.questionCardinality = {min: "1", max: "1"};
    }
  }


  /**
   * Parse questionnaire item for code and code system
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processCode(lfItem, qItem) {
    var code = _getCode(qItem);
    lfItem.questionCode = code.code;
    lfItem.questionCodeSystem = code.system;
  }
  /**
   * Get an object with code and code system
   *
   * @param questionnaireItemOrResource {object} - question
   * @private
   */
  function _getCode(questionnaireItemOrResource) {
    var code = null;
    if(questionnaireItemOrResource &&
         Array.isArray(questionnaireItemOrResource.code) &&
         questionnaireItemOrResource.code.length) {
      code = {};
      switch(questionnaireItemOrResource.code[0].system) {
        case 'http://loinc.org':
          code.system = 'LOINC';
          break;
        default:
          break;
      }

      code.code = questionnaireItemOrResource.code[0].code;
    }
    // If code is missing look for identifier.
    else if(questionnaireItemOrResource &&
      Array.isArray(questionnaireItemOrResource.identifier) &&
      questionnaireItemOrResource.identifier.length) {
      code = {};
      switch(questionnaireItemOrResource.identifier[0].system) {
        case 'http://loinc.org':
          code.system = 'LOINC';
          break;
        default:
          break;
      }
      code.code = questionnaireItemOrResource.identifier[0].value;
    }

    return code;
  }


  /**
   * Parse questionnaire item for coding instructions
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processCodingInstructions(lfItem, qItem) {
    var ci = LForms.Util.findObjectInArray(qItem.extension, 'url', self.fhirExtUrlCodingInstructions);
    if(ci) {
      lfItem.codingInstructions = ci.valueCodeableConcept.coding[0].display;
      lfItem.codingInstructionsFormat = ci.valueCodeableConcept.coding[0].code;
    }
  }


  /**
   * Parse questionnaire item for unit
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processUnit(lfItem, qItem) {
    var unit = LForms.Util.findObjectInArray(qItem.extension, 'url', self.fhirExtUrlUnit);
    if(unit) {
      lfItem.unit = {name: unit.valueCoding};
    }
  }


  /**
   * Parse questionnaire item for restrictions
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processRestrictions (lfItem, qItem) {
    var restrictions = {};
    if(typeof qItem.maxLength !== 'undefined') {
      restrictions['maxLength'] = qItem.maxLength.toString();
    }

    for(var i = 0; i < self.fhirExtUrlRestrictionArray.length; i++) {
      var restriction = LForms.Util.findObjectInArray(qItem.extension, 'url', self.fhirExtUrlRestrictionArray[i]);
      var val = _getValueWithPrefixKey(restriction, /^value/);
      if (val) {

        if(restriction.url.match(/minValue$/)) {
          // TODO -
          // There is no distinction between inclusive and exclusive.
          // Lforms looses this information when converting back and forth.
          restrictions['minInclusive'] = val;
        }
        else if(restriction.url.match(/maxValue$/)) {
          restrictions['maxInclusive'] = val;
        }
        else if(restriction.url.match(/minLength$/)) {
          restrictions['minLength'] = val;
        }
        else if(restriction.url.match(/regex$/)) {
          restrictions['pattern'] = val;
        }
      }
    }

    if(!jQuery.isEmptyObject(restrictions)) {
      lfItem.restrictions = restrictions;
    }
  }


  /**
   * Parse questionnaire item for data type
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processDataType (lfItem, qItem) {
    var type = _getDataType(qItem);
    if(type === 'SECTION' || type === 'TITLE') {
      lfItem.header = true;
    }
    lfItem.dataType = type;
  }


  /**
   * Get lforms data type from questionnaire item
   *
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _getDataType (qItem) {
    var type = 'string';

    switch (qItem.type) {
      case 'string':
        type = 'ST';
        break;
      case 'group':
        type = 'SECTION';
        break;
      case "choice":
        type = 'CNE';
        break;
      case "open-choice":
        type = 'CWE';
        break;
      case 'integer':
        type = 'INT';
        break;
      case 'decimal':
        type = 'REAL';
        break;
      case 'text':
        type = 'TX';
        break;
      case "boolean":
        type = 'BL';
        break;
      case "dateTime":
        //dataType = 'date';
        type = 'DT';
        break;
      case "time":
        type = 'TM';
        break;
      case "display":
        type = 'TITLE';
        break;
      case "url":
        type = 'URL';
        break;
      case "quantity":
        type = 'QTY';
        break;
    }
    return type;
  }


  /**
   * Parse questionnaire item for display control
   *
   * @param lfItem {object} - lfItem to assign the skip logic
   * @param qItem {object} - Questionnaire item object
   * @private
   */
  function _processDisplayControl(lfItem, qItem) {
    var itemControlType = LForms.Util.findObjectInArray(qItem.extension, 'url', self.fhirExtUrlItemControl);

    if(itemControlType) {
      var displayControl = {};
      switch (itemControlType.valueCodeableConcept.coding[0].code) {
        case 'Lookup':
          // TODO -
          // Implies externallyDefined, but the URL is not saved in fhir resource.
          // Perhaps it could be save in itemControlType.valueCodableConcept.text ...
          // lfItem.externallyDefined = itemControlType.valueCodableConcept.text;
          break;
        case 'Combo-box':
          displayControl.answerLayout = {type: 'COMBO_BOX'};
          break;
        case 'Checkbox':
        case 'Radio':
          displayControl.answerLayout = {type: 'RADIO_CHECKBOX'};
          break;
        case 'Table':
          if(lfItem.dataType === 'SECTION') {
            displayControl.questionLayout = "horizontal";
          }
          break;
        case 'Matrix':
          if(lfItem.dataType === 'SECTION') {
            displayControl.questionLayout = "matrix";
          }
          break;
        default:
          displayControl = null;
      }

      if(displayControl && !jQuery.isEmptyObject(displayControl)) {
        lfItem.displayControl = displayControl;
      }
    }
  }


  /**
   * Get value from an object given a partial string of hash key.
   * Use it where at most only one key matches.
   *
   * @param obj {object} - Object to search
   * @param keyRegex {regex} - Regular expression to match a key
   * @returns {*} - Corresponding value of matching key.
   * @private
   */
  function _getValueWithPrefixKey(obj, keyRegex) {
    var ret = null;
    if(typeof obj === 'object') {
      for(var key in obj) {
        if(key.match(keyRegex)) {
          ret = obj[key];
          break;
        }
      }
    }

    return ret;
  }


  /**
   * It is used to identify source item in skip logic. Get code from source item
   * using enableWhen.question text. Use enableWhen.question (_codePath+_idPath),
   * to locate source item with item.linkId.
   *
   * @param topLevelItem - Top level item object to traverse the path searching for
   * enableWhen.question text in linkId .
   * @param questionPath - This is the text in enableWhen.question
   * @returns {string} - Returns code of the source item.
   * @private
   */
  function _getSourceCodeUsingQuestionText(topLevelItem, questionPath) {


    if(topLevelItem.linkId === questionPath) {
      return {
        questionCode: topLevelItem.code[0].code,
        dataType: _getDataType(topLevelItem)
      };
    }

    var ret = null;
    if(Array.isArray(topLevelItem.item)) {
      for(var i = 0; !ret && i < topLevelItem.item.length; i++) {
        ret = _getSourceCodeUsingQuestionText(topLevelItem.item[i], questionPath);
      }
    }

    return ret;
  }

})(LForms.FHIR_SDC);
