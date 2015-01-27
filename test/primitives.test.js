
var primitives = require('../lib/primitives')
  , expect = require('expect.js')
  , helper = require('./helper');

describe('primitive crypto functions', function() {

  describe('nonce()', function() {
    it('should return 16 random bytes', function() {
      expect(primitives.nonce()).to.have.length(16);
      expect(primitives.nonce()).not.equal(primitives.nonce());
    });
  });

  describe('all crypto functions', function() {
    it('should require Buffers as input', function() {
      var str = ''
      var buf = new Buffer(10); buf.fill(0x32);

      expect.Assertion.prototype.with = function() {
        expect(this.obj).to.be.a('function');
        var fn = this.obj;
        var args = Array.prototype.slice.call(arguments);
        return expect(function() { fn.apply(null, args); });
      }

      expect.Assertion.prototype.complain = function() {
        return this.throwException(/not a buffer/i);
      }

      function check() {
        var fns = Array.prototype.slice.call(arguments);
        fns.forEach(function(fn) {
          expect(fn).with(str).to.complain();
          expect(fn).with(buf).not.to.complain();
        });
      }

      check(
        primitives.derive_sender_hmac,
        primitives.derive_sender_key,
        primitives.derive_receiver_hmac,
        primitives.derive_receiver_key
      );

      expect(primitives.encrypt).with(str, str).to.complain();
      expect(primitives.encrypt).with(buf, str).to.complain();
      expect(primitives.encrypt).with(buf, buf).not.to.complain();

      expect(primitives.decrypt).with(str, str, str).to.complain();
      expect(primitives.decrypt).with(buf, str, str).to.complain();
      expect(primitives.decrypt).with(buf, buf, str).to.complain();
      expect(primitives.decrypt).with(buf, buf, buf).not.to.complain();

      expect(primitives.mac).with(str, str).to.complain();
      expect(primitives.mac).with(buf, str).to.complain();
      expect(primitives.mac).with(buf, buf).not.to.complain();
    });

    it('should require a 256-bit key', function() {
      var short = new Buffer(31); short.fill(0x33);
      var exact = new Buffer(32); exact.fill(0x33);
      var long = new Buffer(33); long.fill(0x33);

      function check(fns) {
        for (var i = 0; i < fns.length; i++) {
          var fn = fns[i];
          expect(function(){ fn(short); }).to.throwException(/256-bit/i);
          expect(fn(exact)).to.be.a(Buffer);
          expect(function(){ fn(long); }).to.throwException(/256-bit/i);
        }
      }

      check([
        primitives.derive_sender_hmac,
        primitives.derive_sender_key,
        primitives.derive_receiver_hmac,
        primitives.derive_receiver_key
      ]);
    });
  });

  describe('most utility functions', function() {
    it('should require Buffers as input', function() {
      var str = ''
      var buf = new Buffer(10); buf.fill(0x23);

      expect(function(){ primitives.identify(str); }).to.throwException(/not a buffer/i);
      expect(function(){ primitives.identify(buf); }).not.to.throwException();
      primitives.identify(buf);

      expect(function(){ primitives.compare(str, str); }).to.throwException(/not a buffer/i);
      expect(function(){ primitives.compare(buf, str); }).to.throwException(/not a buffer/i);
      expect(function(){ primitives.compare(buf, buf); }).not.to.throwException();
    });
  });

  describe('derive_sender_hmac()', function() {
    it('should derive a 256-bit hmac key from a 256-bit master key', function() {
      var master_key = new Buffer(32); master_key.fill(0xbc);

      var hmac_key = primitives.derive_sender_hmac(master_key);
      expect(hmac_key).to.have.length(32);
      expect(hmac_key).to.eql(new Buffer('1e2e2725f135463f05c268ffd1c1687dbc9dd7da65405697471052236b3b3088', 'hex'));
    });
  });

  describe('derive_sender_key()', function() {
    it('should derive a 256-bit encryption key from a 256-bit master key', function() {
      var master_key = new Buffer(32); master_key.fill(0xbc);

      var hmac_key = primitives.derive_sender_key(master_key);
      expect(hmac_key).to.have.length(32);
      expect(hmac_key).to.eql(new Buffer('327b5f32d7ff0beeb0a7224166186e5f1fc2ba681092214a25b1465d1f17d837', 'hex'));
    });
  });

  describe('derive_receiver_hmac()', function() {
    it('should derive a 256-bit hmac key from a 256-bit master key', function() {
      var master_key = new Buffer(32); master_key.fill(0xbc);

      var hmac_key = primitives.derive_receiver_hmac(master_key);
      expect(hmac_key).to.have.length(32);
      expect(hmac_key).to.eql(new Buffer('375f52dff2a263f2d0e0df11d252d25ba18b2f9abae1f0cbf299bab8d8c4904d', 'hex'));
    });
  });

  describe('derive_receiver_key()', function() {
    it('should derive a 256-bit encryption key from a 256-bit master key', function() {
      var master_key = new Buffer(32); master_key.fill(0xbc);

      var hmac_key = primitives.derive_receiver_key(master_key);
      expect(hmac_key).to.have.length(32);
      expect(hmac_key).to.eql(new Buffer('c7e2a9660369f243aed71b0de0c49ee69719d20261778fdf39991a456566ef22', 'hex'));
    });
  });

  describe('encrypt()', function() {
    it('should encrypt data using a 256-bit key', function() {
      var key = new Buffer(32); key.fill(0xcd);
      var data = new Buffer(25); data.fill(0x11);

      var binmessage = primitives.encrypt(data, key);
      var iv = binmessage.slice(0,16);
      var ciphertext = binmessage.slice(16);

      expect(iv).to.have.length(16);
      expect(ciphertext).to.have.length(32);
      var recovered = primitives.decrypt(ciphertext, key, iv);
      expect(recovered).to.eql(data);
      expect(recovered).to.not.equal(data);
    });

    it('should return a Buffer of (iv || ciphertext)', function() {
      var key = new Buffer(32); key.fill(0xcd);
      var data = new Buffer(25); data.fill(0x11);

      var output = primitives.encrypt(data, key);
      expect(output).to.be.a(Buffer);
      // 16-byte IV, 32 bytes to encrypt the 25 data bytes
      expect(output).to.have.length(48);
    });
  });

  describe('decrypt()', function() {
    it('should decrypt data using a 256-bit key', function() {
      var key = new Buffer(32); key.fill(0xcd);
      var plaintext = new Buffer(25); plaintext.fill(0x11);
      var iv = new Buffer('d4a5794c81015dde3b9b0648f2b9f5b9', 'hex');
      var ciphertext = new Buffer('cb7f804ec83617144aa261f24af07023a91a3864601a666edea98938f2702dbc', 'hex');

      var recovered = primitives.decrypt(ciphertext, key, iv);
      expect(recovered).to.eql(plaintext);
      expect(recovered).to.not.equal(plaintext);
    });
  });

  describe('identify()', function() {
    it('should calculate an id for a key', function() {
      var key = new Buffer(32); key.fill(0xab);
      var id = primitives.identify(key);

      expect(id).to.have.length(6);
      expect(id).to.eql(new Buffer('0d081b0889d7', 'hex'));
    });
  });

  describe('mac()', function() {
    it('should create a message authentication code', function() {
      var key = new Buffer(32); key.fill(0x9f);
      var data = new Buffer(25); data.fill(0x11);
      var mac = primitives.mac(data, key);

      expect(mac).to.have.length(32);
      expect(mac).to.eql(new Buffer('adf1793fdef44c54a2c01513c0c7e4e71411600410edbde61558db12d0a01c65', 'hex'));
    });
  });

  describe('compare()', function() {
    it('should correctly distinguish data equality', function() {
      var a = new Buffer(25); a.fill(0x11);
      var b = new Buffer(25); b.fill(0x12);
      var c = new Buffer(25); c.fill(0x11);

      expect(primitives.compare(a,a)).to.be.ok();
      expect(primitives.compare(a,b)).to.not.be.ok();
      expect(primitives.compare(a,c)).to.be.ok();
    });

    // This works fine locally, but has tons of variation on build server
    it.skip('should take just as long to compare different data as identical data', function() {
      var a = new Buffer(250000); a.fill(0xff);
      var b = new Buffer(250000); b.fill(0x00);
      var c = new Buffer(250000); c.fill(0xff);

      var benchAA = benchmark(primitives.compare, a, a);
      var benchAB = benchmark(primitives.compare, a, b);
      var benchAC = benchmark(primitives.compare, a, c);

      var naiveAA = benchmark(naiveEquals, a, a);
      var naiveAB = benchmark(naiveEquals, a, b);
      var naiveAC = benchmark(naiveEquals, a, c);

      // All constant-time comparisons should be roughly equal in time
      expect(difference(benchAA, benchAB)).to.be.greaterThan(0.95);
      expect(difference(benchAA, benchAC)).to.be.greaterThan(0.95);
      expect(difference(benchAB, benchAC)).to.be.greaterThan(0.95);

      // Naive comparisons of the same item with itself, or with obviously
      // different items should be ridiculously fast
      expect(difference(benchAA, naiveAA)).to.be.lessThan(0.01);
      expect(difference(benchAB, naiveAB)).to.be.lessThan(0.01);

      // It should take just about as long to compare identical arrays as the constant time compare
      expect(difference(benchAC, naiveAC)).to.be.greaterThan(0.90);

      function naiveEquals(a, b) {
        if (a === b) return true;
        for (var i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) {
            return false;
          }
        }
        return true;
      }

      function benchmark(fn, a, b) {
        var time = process.hrtime();
        for (var i = 0; i < 250; i++) {
          fn(a, b);
        };
        var diff = process.hrtime(time);
        return diff[0] * 1e9 + diff[1];
      }

      function difference(first, second) {
        var smaller = Math.min(first, second);
        var larger = Math.max(first, second);
        return (smaller / larger);
      }

    });
  });

  describe('binify()', function() {
    it('should require a base64url string', function() {
      expect(function(){ primitives.binify(123); }).to.throwException(/string required/i);
      expect(function(){ primitives.binify('arstnei; another.'); }).to.throwException(/base64url/i);
      expect(function(){ primitives.binify('cartinir90_-'); }).to.not.throwException();
    });

    it('should return a Buffer', function() {
      var bin = primitives.binify('abcd');
      expect(bin).to.be.a(Buffer);
      expect(bin).to.have.length(3);
    });
  });

  describe('stringify()', function() {
    it('should require a buffer', function() {
      var buf = new Buffer(10); buf.fill(0x32);
      expect(function(){ primitives.stringify(''); }).to.throwException(/not a buffer/i);
      expect(function(){ primitives.stringify(buf); }).not.to.throwException();
    });

    it('should return a base64url string', function() {
      var buf = new Buffer(10); buf.fill(0x32);
      var str = primitives.stringify(buf);
      expect(str).to.be.a('string');
      expect(str).to.have.length(14);
      expect(str).to.match(/^[a-zA-Z0-9_-]+$/);
    });
  });

  describe('serialize()', function() {
    it('should accept javascript object', function() {
      expect(function(){ primitives.serialize(1); }).to.not.throwException();
      expect(function(){ primitives.serialize('a'); }).to.not.throwException();
      expect(function(){ primitives.serialize([]); }).to.not.throwException();
      expect(function(){ primitives.serialize({}); }).to.not.throwException();
    });

    it('should return a Buffer', function() {
      var bin = primitives.serialize('abcd');
      expect(bin).to.be.a(Buffer);
      expect(bin).to.have.length(5);
    });
  });

  describe('deserialize()', function() {
    it('should require a buffer', function() {
      var buf = new Buffer(10); buf.fill(0x32);
      expect(function(){ primitives.deserialize(''); }).to.throwException(/not a buffer/i);
      expect(function(){ primitives.deserialize(buf); }).not.to.throwException();
    });

    it('should return a javascript primitive or object', function() {
      expect(primitives.deserialize(primitives.serialize(1))).to.eql(1);
      expect(primitives.deserialize(primitives.serialize('abcd'))).to.eql('abcd');
      expect(primitives.deserialize(primitives.serialize([]))).to.eql([]);
      expect(primitives.deserialize(primitives.serialize({}))).to.eql({});
    });
  });

  describe('zero()', function() {

    it('should require a Buffer', function() {
      expect(function(){ primitives.zero({}); }).to.throwException(/not a buffer/i);
    });

    it('should overwrite all buffer contents with zeros', function() {
      var b = new Buffer([74, 68, 69, 73, 20, 69, 73, 20, 73, 0x6f, 0x6d, 65]);
      var z = new Buffer([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      // different contents
      expect(b).not.to.eql(z);

      primitives.zero(b);

      // different identity, same contents
      expect(b).not.to.equal(z);
      expect(b).to.eql(z);
    });

    it('should zero multiple buffers', function() {
      var b = new Buffer([74, 68, 69, 73, 20, 69, 73, 20, 73, 0x6f, 0x6d, 65]);
      var c = new Buffer([69, 73, 20, 73, 0x6f, 0x6d, 65, 74, 68, 69, 73, 20]);
      var z = new Buffer([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      // different contents
      expect(b).not.to.eql(z);
      expect(c).not.to.eql(z);

      primitives.zero(b, c);

      // different identity, same contents
      expect(b).not.to.equal(z);
      expect(b).to.eql(z);
      expect(c).not.to.equal(z);
      expect(c).to.eql(z);
    });

  });

});