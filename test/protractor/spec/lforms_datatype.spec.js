var tp = require('./lforms_testpage.po.js');

describe('Data Type', function() {

  var typeTitle = element(by.css("label[for='/titleHeader/1']"));

  it('TITLE row should appear', function () {
    tp.openFullFeaturedForm();
    expect(typeTitle.isDisplayed()).toBe(true);
  });


  describe('Button Type', function() {

    it('Each button should have a type="button" so that ENTER does not submit a form (or trigger ng-click on the buttons)', function () {
      tp.openUSSGFHTHorizontal();

      var name1 = element(by.id('/54126-8/54125-0/1/1')),
          name2 = element(by.id('/54126-8/54125-0/1/2'));

      name1.click();
      name1.sendKeys(protractor.Key.ENTER);
      // nothing should happen
      expect(name2.isPresent()).toBe(false);
    });

  });

  describe("Items with units", function() {
    
    it("should have the REAL data type", function() {
      tp.openVitalSign();
      var field1 = element(by.id('/3140-1/1')),
          field2 = element(by.id('/9279-1/1')),
          field3 = element(by.id('/8310-5/1'));

      expect(field1.getAttribute('type')).toBe("text");
      field1.evaluate("item.dataType").then(function (value) {
        expect(value).toBe('INT');
      });
      expect(field2.getAttribute('type')).toBe("text");
      field2.evaluate("item.dataType").then(function (value) {
        expect(value).toBe('REAL');
      });
      expect(field3.getAttribute('type')).toBe("text");
      field3.evaluate("item.dataType").then(function (value) {
        expect(value).toBe('REAL');
      });

    });
  });
});
