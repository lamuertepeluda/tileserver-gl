describe('Rendered features', function() {
  it('Should return features at given point', function(done) {
    var test = supertest(app).get('/styles/test-style/11/renderedfeatures' + '?point=8.707351684570312,47.359292508710716');
    test.expect(200);
    test.expect(function(res) {
      res.body.should.have.lengthOf(1);
      res.body[0].id.should.equal(92);
    });
    test.end(done);
  });

  it('Should return features in given bounding box', function(done) {
    var test = supertest(app).get('/styles/test-style/11/renderedfeatures' + '?bbox=8.7,47.3,8.8,47.4');
    test.expect(200);
    test.expect(function(res) {
      res.body.should.have.lengthOf(1);
      res.body[0].id.should.equal(92);
    });
    test.end(done);
  });

  it('Should return features in larger bounding box', function(done) {
    var test = supertest(app).get('/styles/test-style/11/renderedfeatures' + '?bbox=8.3,47,9.2,47.7');
    test.expect(200);
    test.expect(function(res) {
      res.body.should.have.lengthOf(27);
    });
    test.end(done);
  });
});
